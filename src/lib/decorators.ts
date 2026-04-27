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

import { StaticToken, created, injectable } from '@joist/di';
import type { InjectorOpts } from '@joist/di/injector.js';
import { join } from 'node:path';

import { HTTP_SERVER, type HttpHandler, type HttpServer } from '#lib/http.service.js';

type LifeCycleCondition = Parameters<typeof created>[0];
type RouteMethod = keyof Pick<HttpServer, 'delete' | 'get' | 'post' | 'put' | 'use'>;

const BASE_PATH = new StaticToken<string>('BASE_PATH', () => '');

function route(method: RouteMethod) {
  return function registerRoute<T extends string, This extends object>(
    path?: T,
    condition?: LifeCycleCondition
  ) {
    return function routeDecorator(target: HttpHandler, ctx: ClassMethodDecoratorContext) {
      return created(condition)(function (this: This, injector) {
        const httpServer = injector.inject(HTTP_SERVER);
        const basePath = injector.inject(BASE_PATH);

        httpServer[method](join(basePath, path ?? '') as T, target.bind(this));
      }, ctx);
    };
  };
}

export const get = route('get');
export const post = route('post');
export const put = route('put');
export const del = route('delete');
export const use = route('use');

export function controller(path?: string, opts?: InjectorOpts) {
  const providers = opts?.providers ?? [];

  return injectable({
    providers: [...providers, [BASE_PATH, { factory: () => path ?? '' }]],
  });
}
