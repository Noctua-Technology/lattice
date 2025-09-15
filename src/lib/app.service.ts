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

import { serve } from '@hono/node-server';
import { inject, injectable, Injector } from '@joist/di';
import type { AddressInfo } from 'node:net';
import path from 'node:path';

import { HonoService } from './hono.service.js';
import { FS } from './services.js';

export interface AppConfig {
  dir?: string;
  globs?: string[];
  port?: number;
  transformPaths?: (paths: string[]) => string[];
}

@injectable({
  name: 'LatticeApp',
})
export class LatticeApp {
  #fs = inject(FS);
  #injector = inject(Injector);
  #hono = inject(HonoService);

  config: AppConfig = {};

  async serve(config: AppConfig = {}) {
    this.config = config;

    const hono = this.#hono();

    await this.registerRoutes();

    return new Promise<AddressInfo>((resolve) => {
      serve({ fetch: hono.fetch, port: this.config.port ?? 8080 }, resolve);
    });
  }

  async registerRoutes() {
    const injector = this.#injector();
    const controllerPaths = this.findControllers();

    const controllers = await Promise.all(
      controllerPaths.map((file) => import(file).then((m) => m.default))
    );

    for (const controller of controllers) {
      injector.inject(controller);
    }
  }

  findControllers(): string[] {
    const fs = this.#fs();

    const { dir = process.cwd() } = this.config;

    const {
      globs = [path.join(dir, '**/*.{controller,middleware}.js')],
      transformPaths = sortControllers,
    } = this.config;

    const paths = globs.flatMap((glob) => fs.globSync(glob));

    return transformPaths(paths);
  }
}

function sortControllers(paths: string[]) {
  return paths.toSorted((a, b) => {
    if (a.includes('middleware') && !b.includes('middleware')) {
      return -1;
    }

    if (!a.includes('middleware') && b.includes('middleware')) {
      return 1;
    }

    return 0;
  });
}
