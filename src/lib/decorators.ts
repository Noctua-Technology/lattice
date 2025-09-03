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
import type { Handler } from 'hono';
import { join } from 'node:path';

import { HonoService } from './hono.service.js';

type LifeCycleCondition = Parameters<typeof created>[0];

const BASE_PATH = new StaticToken<string>('BASE_PATH', () => '');

export function get<T extends string, This extends object>(
  path?: T,
  condition?: LifeCycleCondition
) {
  return function getDecorator(target: Handler<any, T, any>, ctx: ClassMethodDecoratorContext) {
    return created(condition)(function (this: This, injector) {
      const hono = injector.inject(HonoService);
      const basePath = injector.inject(BASE_PATH);

      hono.get<T>(join(basePath, path ?? '') as T, target.bind(this));
    }, ctx);
  };
}

export function post<T extends string, This extends object>(
  path?: T,
  condition?: LifeCycleCondition
) {
  return function getDecorator(target: Handler<any, T, any>, ctx: ClassMethodDecoratorContext) {
    return created(condition)(function (this: This, injector) {
      const hono = injector.inject(HonoService);
      const basePath = injector.inject(BASE_PATH);

      hono.post<T>(join(basePath, path ?? '') as T, target.bind(this));
    }, ctx);
  };
}

export function use<T extends string, This extends object>(
  path?: T,
  condition?: LifeCycleCondition
) {
  return function getDecorator(target: Handler<any, T, any>, ctx: ClassMethodDecoratorContext) {
    return created(condition)(function (this: This, injector) {
      const hono = injector.inject(HonoService);
      const basePath = injector.inject(BASE_PATH);

      hono.use<T>(join(basePath, path ?? '') as T, target.bind(this));
    }, ctx);
  };
}

export function controller(path?: string, opts?: InjectorOpts) {
  const providers = opts?.providers ?? [];

  return injectable({
    providers: [...providers, [BASE_PATH, { factory: () => path ?? '' }]],
  });
}
