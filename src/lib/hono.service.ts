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

import { serve, type ServerType } from '@hono/node-server';
import { injectable } from '@joist/di';
import { Hono } from 'hono';
import type { AddressInfo } from 'node:net';

import type { HttpServer } from '#lib/http.service.js';

@injectable({
  name: 'HonoService',
})
export class HonoService extends Hono implements HttpServer {
  #server?: ServerType;

  async listen(port: number) {
    return new Promise<AddressInfo>((resolve) => {
      this.#server = serve({ fetch: this.fetch, port }, resolve);
    });
  }

  async close(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.#server) {
        resolve();
      } else {
        this.#server.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      }
    });
  }
}
