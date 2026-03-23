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

import { inject, injectable } from '@joist/di';
import path from 'node:path';
import { z } from 'zod';

import { FS } from '#lib/services.js';
import { Result } from '@noctuatech/result';

export const CONFIG_FILE_NAMES = ['lattice.config.json', 'lattice.config.js'];

const AppConfig = z
  .object({
    dir: z.string().optional(),
    globs: z.array(z.string()).optional(),
    port: z.number().int().min(1).max(65535).optional(),
    transformPaths: z
      .function({ input: [z.array(z.string())], output: z.array(z.string()) })
      .optional(),
  })
  .strict();

export type AppConfig = z.infer<typeof AppConfig>;

function validateConfig(value: unknown, filePath: string): AppConfig {
  return Result.wrap(() => {
    const result = AppConfig.safeParse(value);

    if (!result.success) {
      throw new Error(`Invalid lattice config at ${filePath}: ${result.error.message}`);
    }

    return result.data;
  }).unwrapOr({});
}

@injectable({
  name: 'LatticeConfigService',
})
export class LatticeConfigService {
  #fs = inject(FS);

  /**
   * Searches for a lattice config file starting from `dir` and walking up
   * the directory tree. Returns the resolved path to the first config file
   * found, or `null` if none exists.
   */
  findConfigFile(dir: string = process.cwd()): string | null {
    const fs = this.#fs();
    let current = path.resolve(dir);

    while (true) {
      for (const name of CONFIG_FILE_NAMES) {
        const candidate = path.join(current, name);

        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }

      const parent = path.dirname(current);

      if (parent === current) {
        return null;
      }

      current = parent;
    }
  }

  /**
   * Reads and parses a lattice config file. JSON files are parsed with
   * `JSON.parse`; JS files are loaded as ES modules via dynamic `import()`.
   */
  async readConfig(filePath: string): Promise<AppConfig> {
    if (filePath.endsWith('.json')) {
      const fs = this.#fs();
      const raw = fs.readFileSync(filePath, 'utf-8');

      return validateConfig(JSON.parse(raw), filePath);
    }

    const mod = await import(filePath);

    return validateConfig(mod.default ?? mod, filePath);
  }

  /**
   * Locates the nearest config file from `dir` and returns its parsed
   * contents, or `null` if no config file is found.
   */
  async load(dir: string = process.cwd()): Promise<AppConfig | null> {
    const configPath = this.findConfigFile(dir);

    if (!configPath) {
      return null;
    }

    return this.readConfig(configPath);
  }
}
