/**
 * Copyright 2025 Noctua Technology
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { inject, injectable, Injector, type InjectionToken } from '@joist/di';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { readMetadata } from '#lib.js';
import { LatticeConfigService, type AppConfig } from '#lib/config.service.js';
import { HTTP_SERVER } from '#lib/http.service.js';
import { FS } from '#lib/services.js';

@injectable({
  name: 'LatticeApp',
})
export class LatticeApp {
  #config = inject(LatticeConfigService);
  #fs = inject(FS);
  #httpServer = inject(HTTP_SERVER);
  #injector = inject(Injector);

  config: AppConfig = {};

  async serve(config: AppConfig = {}) {
    const configService = this.#config();
    const httpServer = this.#httpServer();

    const loadedConfig = await configService.load(config.dir ?? this.config.dir);

    this.config = { ...loadedConfig, ...this.config, ...config };

    await this.registerRoutes();

    return httpServer.listen(this.config.port ?? 8080) as Promise<AddressInfo>;
  }

  async close() {
    const httpServer = this.#httpServer();
    await httpServer.close();
  }

  async register(m: string | InjectionToken<unknown>) {
    const injector = this.#injector();

    let controller: InjectionToken<unknown>;

    if (typeof m === 'string') {
      const importPath = path.isAbsolute(m) ? pathToFileURL(m).href : m;
      controller = await import(importPath).then((m) => m.default);
    } else {
      controller = m;
    }

    injector.inject(controller);
  }

  async registerRoutes() {
    const injector = this.#injector();
    const controllerPaths = this.findControllers();

    const controllers = await Promise.all(
      controllerPaths.map(async (file) => {
        try {
          const importPath = path.isAbsolute(file) ? pathToFileURL(file).href : file;
          const m = await import(importPath);
          if (!m || !m.default) {
            throw new Error('Module has no default export.');
          }
          return { file, module: m.default };
        } catch (err: any) {
          const isTsSyntaxError =
            file.endsWith('.ts') &&
            (err instanceof SyntaxError || err?.cause instanceof SyntaxError);

          const message = isTsSyntaxError
            ? `Failed to load TypeScript file "${file}". Direct execution of .ts files requires a loader (e.g. tsx or ts-node): ${err.message}`
            : `Failed to load controller or middleware at "${file}": ${err.message}`;

          throw new Error(message, {
            cause: err,
          });
        }
      })
    );

    controllers.sort((a, b) => {
      const isMwA = a.file.includes('middleware');
      const isMwB = b.file.includes('middleware');

      if (isMwA !== isMwB) {
        return isMwA ? -1 : 1;
      }

      const metadataA = readMetadata(a.module);
      const metadataB = readMetadata(b.module);

      const weightA = metadataA?.weight ?? 0;
      const weightB = metadataB?.weight ?? 0;

      return weightA - weightB;
    });

    for (const controller of controllers) {
      injector.inject(controller.module);
    }
  }

  findControllers(): string[] {
    const fs = this.#fs();

    const { dir = process.cwd() } = this.config;
    const normalizedDir = dir.replaceAll('\\', '/');

    const {
      globs = [path.posix.join(normalizedDir, '**/*.{controller,middleware}.{js,ts}')],
      transformPaths = sortControllers,
    } = this.config;

    const rawPaths = globs.flatMap((glob) =>
      fs.globSync(glob, {
        exclude: (entry) =>
          entry.endsWith('.d.ts') || entry.split(/[\\/]/).includes('node_modules'),
      })
    );

    const fileMap = new Map<string, string>();
    for (const filePath of rawPaths) {
      const key = getModuleKey(filePath);
      const existing = fileMap.get(key);

      if (!existing || filePath.endsWith('.js')) {
        fileMap.set(key, filePath);
      }
    }

    return transformPaths(Array.from(fileMap.values()));
  }
}

function getModuleKey(filePath: string): string {
  const normPath = filePath.replaceAll('\\', '/');
  return normPath.replace(/\.(js|ts)$/, '');
}

function sortControllers(paths: string[]) {
  return paths.toSorted((a, b) => {
    const isMwA = a.includes('middleware');
    const isMwB = b.includes('middleware');
    return isMwA === isMwB ? 0 : isMwA ? -1 : 1;
  });
}
