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

import { StaticToken } from '@joist/di';
import type { AddressInfo } from 'node:net';

import { HonoService } from '#lib/hono.service.js';

export type HttpHandler = (...args: any[]) => unknown;

export interface HttpServer {
  get(path: string, handler: HttpHandler): unknown;
  post(path: string, handler: HttpHandler): unknown;
  put(path: string, handler: HttpHandler): unknown;
  delete(path: string, handler: HttpHandler): unknown;
  use(path: string, handler: HttpHandler): unknown;
  listen(port: number): Promise<AddressInfo> | AddressInfo;
}

export const HTTP_SERVER = new StaticToken<HttpServer>('HTTP_SERVER', (injector) => {
  return injector.inject(HonoService);
});
