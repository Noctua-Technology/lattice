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
import type { Context, Next } from 'hono';
import { posix } from 'node:path';

import { HTTP_SERVER, type HttpHandler } from '#lib/http.service.js';

type LifeCycleCondition = Parameters<typeof created>[0];
type RouteMethod = 'delete' | 'get' | 'patch' | 'post' | 'put' | 'use';

const BASE_PATH = new StaticToken<string>('BASE_PATH', () => '');

export interface Middleware {
  middleware(ctx: Context, next: Next): unknown;
}

export type MiddlewareClass = new (...args: any[]) => Middleware;

const controllerMiddlewareMap = new WeakMap<object, MiddlewareClass[]>();
const routeMiddlewareMap = new WeakMap<object, MiddlewareClass[]>();

function route(method: RouteMethod) {
  return function registerRoute<T extends string, This extends object>(
    path?: T,
    condition?: LifeCycleCondition
  ) {
    return function routeDecorator(target: HttpHandler, ctx: ClassMethodDecoratorContext) {
      return created(condition)(function (this: This, injector) {
        const httpServer = injector.inject(HTTP_SERVER);
        const basePath = injector.inject(BASE_PATH);

        const controllerMiddleware: MiddlewareClass[] = [];

        let currentClass = this.constructor;

        while (currentClass && currentClass !== Object.prototype) {
          const mws = controllerMiddlewareMap.get(currentClass);

          if (mws) {
            controllerMiddleware.push(...mws);
          }

          currentClass = Object.getPrototypeOf(currentClass);
        }

        const routeMiddlewares = routeMiddlewareMap.get(target) || [];

        const allMiddleware = [...controllerMiddleware, ...routeMiddlewares];
        const resolvedHandlers: HttpHandler[] = [];

        for (const mw of allMiddleware) {
          const instance = injector.inject(mw);

          resolvedHandlers.push(instance.middleware.bind(instance));
        }

        if (method === 'use') {
          resolvedHandlers.push(target.bind(this));
        } else {
          resolvedHandlers.push(async (ctx, next) => {
            const result = await target.call(this, ctx, next);

            if (result instanceof Response) {
              return result;
            }

            if (result !== undefined && result !== null) {
              if (typeof result === 'object') {
                return ctx.json(result);
              }

              if (typeof result === 'string') {
                return ctx.text(result);
              }

              return ctx.text(String(result));
            }

            return next();
          });
        }

        const routePath = posix.join(basePath, path ?? '') as T;
        httpServer[method](routePath, ...resolvedHandlers);
      }, ctx);
    };
  };
}

export const get = route('get');
export const post = route('post');
export const put = route('put');
export const del = route('delete');
export const patch = route('patch');

export function use(path: string, condition?: LifeCycleCondition): any;
export function use(...middlewares: MiddlewareClass[]): any;
export function use(...args: any[]) {
  if (typeof args[0] === 'string') {
    const path = args[0];
    const condition = args[1] as LifeCycleCondition | undefined;
    return route('use')(path, condition);
  }

  return function (value: any, context: ClassDecoratorContext | ClassMethodDecoratorContext) {
    if (context.kind === 'class') {
      const existing = controllerMiddlewareMap.get(value) || [];
      controllerMiddlewareMap.set(value, [...args, ...existing]);
    } else if (context.kind === 'method') {
      const existing = routeMiddlewareMap.get(value) || [];
      routeMiddlewareMap.set(value, [...args, ...existing]);
    } else {
      throw new Error('@use decorator can only be used on classes or methods');
    }
  };
}

interface ControllerOpts extends InjectorOpts {
  weight?: number | undefined;
}

export function readMetadata(target: unknown): ControllerOpts | null {
  if (target && (typeof target === 'object' || typeof target === 'function') && Symbol.metadata in target) {
    const metadata = target[Symbol.metadata];

    return metadata as ControllerOpts;
  }

  return null;
}

export function controller(path?: string, opts?: ControllerOpts) {
  const providers = opts?.providers ?? [];

  return (target: any, context: ClassDecoratorContext) => {
    const metadata: ControllerOpts = context.metadata;
    metadata.weight = opts?.weight;

    return injectable({
      providers: [...providers, [BASE_PATH, { factory: () => path ?? '' }]],
    })(target, context);
  };
}
