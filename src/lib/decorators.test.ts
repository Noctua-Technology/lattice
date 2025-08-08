import { Injector } from '@joist/di';
import { assert } from 'chai';
import type { Context, Next } from 'hono';
import test from 'node:test';

import { controller, get, post, use } from './decorators.js';
import { HonoService } from './hono.service.js';

test('decorators: get', async () => {
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

test('decorators: post', async () => {
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

test('decorators: use', async () => {
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
