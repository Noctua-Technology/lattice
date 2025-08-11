import { Injector } from '@joist/di';
import { assert } from 'chai';
import { Hono } from 'hono';
import test from 'node:test';
import path from 'path';

import { LATTICE_CONFIG, LatticeApp } from './app.service.js';
import { HonoService } from './hono.service.js';

test('it should find controllers and sort them so that all middleware are registered first', () => {
  const injector = new Injector({
    providers: [[HonoService, { use: Hono }]],
  });

  const app = injector.inject(LatticeApp);

  const controllers = app.findControllers();

  assert.deepEqual(controllers, [
    path.join(import.meta.dirname, '/mock/c.middleware.js'),
    path.join(import.meta.dirname, '/mock/a.controller.js'),
    path.join(import.meta.dirname, '/mock/b.controller.js'),
    path.join(import.meta.dirname, '/mock/d.controller.js'),
  ]);
});

test('it should use custom sort function from config', () => {
  const injector = new Injector({
    providers: [
      [HonoService, { use: Hono }],
      [
        LATTICE_CONFIG,
        {
          factory: () => ({
            transformPaths(paths: string[]) {
              return paths.toSorted((a, b) => b.localeCompare(a));
            },
          }),
        },
      ],
    ],
  });

  const app = injector.inject(LatticeApp);

  const controllers = app.findControllers();

  // With custom reverse alphabetical sort, expect: d.controller, c.middleware, b.controller, a.controller
  assert.deepEqual(controllers, [
    path.join(import.meta.dirname, '/mock/d.controller.js'),
    path.join(import.meta.dirname, '/mock/c.middleware.js'),
    path.join(import.meta.dirname, '/mock/b.controller.js'),
    path.join(import.meta.dirname, '/mock/a.controller.js'),
  ]);
});

test('it should register controllers and middleware', async () => {
  const injector = new Injector({
    providers: [[HonoService, { use: Hono }]],
  });

  const app = injector.inject(LatticeApp);
  const hono = injector.inject(HonoService);

  await app.registerRoutes();

  assert.deepEqual(
    hono.routes.map((r) => `${r.method} ${r.path}`),
    ['ALL /*', 'GET /a', 'GET /b', 'GET /d']
  );
});

test('it should handle HTTP requests with correct responses and headers', async () => {
  const injector = new Injector({
    providers: [[HonoService, { use: Hono }]],
  });

  const app = injector.inject(LatticeApp);
  const hono = injector.inject(HonoService);

  await app.registerRoutes();

  for (const path of ['/a', '/b', '/d']) {
    const response = await hono.request(path);
    assert.strictEqual(response.status, 200);
    assert.deepEqual(await response.json(), { message: `Controller ${path}` });
    assert.strictEqual(response.headers.get('middleware-c'), 'active');
  }
});
