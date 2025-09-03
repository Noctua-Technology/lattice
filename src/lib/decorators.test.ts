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

import { Injector } from '@joist/di';
import { assert } from 'chai';
import type { Context, Next } from 'hono';
import suite from 'node:test';

import { controller, get, post, use } from './decorators.js';
import { HonoService } from './hono.service.js';

suite('decorators', async (ctx) => {
  await ctx.test('get', async () => {
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

  await ctx.test('post', async () => {
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

  await ctx.test('use', async () => {
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
});
