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

import { Injector, injectable } from '@joist/di';
import { assert } from 'chai';
import type { Context, Next } from 'hono';
import type { AddressInfo } from 'node:net';
import { describe, it } from 'node:test';

import { controller, del, get, post, put, use, type Middleware } from '#lib/decorators.js';
import { HonoService } from '#lib/hono.service.js';
import { HTTP_SERVER, type HttpHandler, type HttpServer } from '#lib/http.service.js';

class TestHttpServer implements HttpServer {
  routes: string[] = [];

  get(path: string, ..._handlers: HttpHandler[]) {
    this.routes.push(`GET ${path}`);
  }

  post(path: string, ..._handlers: HttpHandler[]) {
    this.routes.push(`POST ${path}`);
  }

  put(path: string, ..._handlers: HttpHandler[]) {
    this.routes.push(`PUT ${path}`);
  }

  delete(path: string, ..._handlers: HttpHandler[]) {
    this.routes.push(`DELETE ${path}`);
  }

  use(path: string, ..._handlers: HttpHandler[]) {
    this.routes.push(`USE ${path}`);
  }

  listen(port: number) {
    return Promise.resolve({
      address: '127.0.0.1',
      family: 'IPv4',
      port,
    } satisfies AddressInfo);
  }
}

describe('decorators', () => {
  it('registers routes against the configured http server token', () => {
    const injector = new Injector({
      providers: [[HTTP_SERVER, { use: TestHttpServer }]],
    });
    const httpServer = injector.inject(HTTP_SERVER);

    if (!(httpServer instanceof TestHttpServer)) {
      throw new Error('expected TestHttpServer to be resolved from HTTP_SERVER');
    }

    @controller('/api')
    class Controller {
      @use('*')
      middleware() {}

      @get('/items')
      list() {}
    }

    const instance = injector.inject(Controller);

    assert.instanceOf(instance, Controller);
    assert.deepEqual(httpServer.routes, ['USE /api/*', 'GET /api/items']);
  });

  it('get', async () => {
    const injector = new Injector();
    const hono = injector.inject(HonoService);

    @controller()
    class Controller {
      @get('/test')
      async test(ctx: Context) {
        return ctx.json({ message: 'test' });
      }
    }

    const instance = injector.inject(Controller);

    assert.instanceOf(instance, Controller);

    const res = await hono.request('/test');

    assert.strictEqual(res.status, 200);
    assert.deepEqual(await res.json(), { message: 'test' });
  });

  it('post', async () => {
    const injector = new Injector();
    const hono = injector.inject(HonoService);

    @controller()
    class Controller {
      @post('/test')
      async test(ctx: Context) {
        const body = await ctx.req.json();

        return ctx.json(body);
      }
    }

    const instance = injector.inject(Controller);

    assert.instanceOf(instance, Controller);

    const res = await hono.request('/test', {
      method: 'POST',
      body: JSON.stringify({ message: 'test from post' }),
    });

    assert.strictEqual(res.status, 200);
    assert.deepEqual(await res.json(), { message: 'test from post' });
  });

  it('put', async () => {
    const injector = new Injector();
    const hono = injector.inject(HonoService);

    @controller()
    class Controller {
      @put('/test')
      async test(ctx: Context) {
        const body = await ctx.req.json();

        return ctx.json({ updated: true, ...body });
      }
    }

    const instance = injector.inject(Controller);

    assert.instanceOf(instance, Controller);

    const res = await hono.request('/test', {
      method: 'PUT',
      body: JSON.stringify({ id: 1, name: 'updated' }),
    });

    assert.strictEqual(res.status, 200);
    assert.deepEqual(await res.json(), { updated: true, id: 1, name: 'updated' });
  });

  it('del', async () => {
    const injector = new Injector();
    const hono = injector.inject(HonoService);

    @controller()
    class Controller {
      @del('/test')
      async test(ctx: Context) {
        return ctx.json({ deleted: true });
      }
    }

    const instance = injector.inject(Controller);

    assert.instanceOf(instance, Controller);

    const res = await hono.request('/test', {
      method: 'DELETE',
    });

    assert.strictEqual(res.status, 200);
    assert.deepEqual(await res.json(), { deleted: true });
  });

  it('use', async () => {
    const injector = new Injector();
    const hono = injector.inject(HonoService);

    @controller()
    class Controller {
      @use('*')
      async middleware(ctx: Context, next: Next) {
        ctx.header('X-Middleware', 'test');

        return next();
      }

      @get('/test')
      async test(ctx: Context) {
        return ctx.json({ message: 'test' });
      }
    }

    const instance = injector.inject(Controller);

    assert.instanceOf(instance, Controller);

    const res = await hono.request('/test');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('X-Middleware'), 'test');
    assert.deepEqual(await res.json(), { message: 'test' });
  });

  it('supports route-level class middleware', async () => {
    const injector = new Injector();
    const hono = injector.inject(HonoService);

    const log: string[] = [];

    @injectable()
    class ClassMiddleware1 implements Middleware {
      async middleware(ctx: Context, next: Next) {
        log.push('class-middleware-1');
        await next();
      }
    }

    @injectable()
    class ClassMiddleware2 implements Middleware {
      async middleware(ctx: Context, next: Next) {
        log.push('class-middleware-2');
        await next();
      }
    }

    @controller()
    class Controller {
      @get('/test-route-mw')
      @use(ClassMiddleware1)
      @use(ClassMiddleware2)
      async test(ctx: Context) {
        log.push('handler');
        return ctx.json({ ok: true });
      }
    }

    injector.inject(Controller);

    const res = await hono.request('/test-route-mw');
    assert.strictEqual(res.status, 200);
    assert.deepEqual(log, ['class-middleware-1', 'class-middleware-2', 'handler']);
  });

  it('supports controller-level and route-level middleware combination and ordering', async () => {
    const injector = new Injector();
    const hono = injector.inject(HonoService);

    const log: string[] = [];

    @injectable()
    class ControllerMw1 implements Middleware {
      async middleware(ctx: Context, next: Next) {
        log.push('ctrl1');
        await next();
      }
    }

    @injectable()
    class ControllerMw2 implements Middleware {
      async middleware(ctx: Context, next: Next) {
        log.push('ctrl2');
        await next();
      }
    }

    @injectable()
    class RouteMw implements Middleware {
      async middleware(ctx: Context, next: Next) {
        log.push('route');
        await next();
      }
    }

    @controller('/multi-mw')
    @use(ControllerMw1)
    @use(ControllerMw2)
    class Controller {
      @get('/test')
      @use(RouteMw)
      async test(ctx: Context) {
        log.push('handler');
        return ctx.json({ ok: true });
      }
    }

    injector.inject(Controller);

    const res = await hono.request('/multi-mw/test');
    assert.strictEqual(res.status, 200);
    assert.deepEqual(log, ['ctrl1', 'ctrl2', 'route', 'handler']);
  });
});
