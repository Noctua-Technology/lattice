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
import { Hono } from 'hono';
import suite from 'node:test';
import path from 'path';

import { LATTICE_CONFIG, LatticeApp } from './app.service.js';
import { HonoService } from './hono.service.js';

suite('app.service', async (ctx) => {
  await ctx.test(
    'it should find controllers and sort them so that all middleware are registered first',
    () => {
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
    }
  );

  await ctx.test('it should use custom sort function from config', () => {
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

  await ctx.test('it should register controllers and middleware', async () => {
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

  await ctx.test('it should handle HTTP requests with correct responses and headers', async () => {
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
});
