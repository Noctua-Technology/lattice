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
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { LatticeApp } from '#lib/app.service.js';
import { HonoService } from '#lib/hono.service.js';
import { HTTP_SERVER, type HttpHandler, type HttpServer } from '#lib/http.service.js';

class TestHttpServer implements HttpServer {
  listenPort?: number;
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

  patch(path: string, ..._handlers: HttpHandler[]) {
    this.routes.push(`PATCH ${path}`);
  }

  delete(path: string, ..._handlers: HttpHandler[]) {
    this.routes.push(`DELETE ${path}`);
  }

  use(path: string, ..._handlers: HttpHandler[]) {
    this.routes.push(`USE ${path}`);
  }

  listen(port: number) {
    this.listenPort = port;

    return Promise.resolve({
      address: '127.0.0.1',
      family: 'IPv4',
      port,
    } satisfies AddressInfo);
  }

  close() {
    return Promise.resolve();
  }
}

describe('app.service', () => {
  it('should support a custom http server implementation', async () => {
    const injector = new Injector({
      providers: [[HTTP_SERVER, { use: TestHttpServer }]],
    });

    const app = injector.inject(LatticeApp);
    app.config.dir = path.join(import.meta.dirname, '../mock');
    const httpServer = injector.inject(HTTP_SERVER) as TestHttpServer;

    await app.registerRoutes();

    assert.deepEqual(httpServer.routes, ['USE *', 'GET /a', 'GET /b', 'GET /d']);

    const address = await app.serve({
      dir: path.join(import.meta.dirname, '/__fixtures_does_not_exist__'),
      port: 9090,
    });

    assert.strictEqual(httpServer.listenPort, 9090);
    assert.strictEqual(address.port, 9090);
  });

  it('should find controllers and sort them so that all middleware are registered first', () => {
    const injector = new Injector({
      providers: [[HonoService, { use: Hono }]],
    });

    const app = injector.inject(LatticeApp);
    app.config.dir = path.join(import.meta.dirname, '../mock');

    const controllers = app.findControllers();

    assert.deepEqual(controllers, [
      path.join(import.meta.dirname, '../mock/c.middleware.js'),
      path.join(import.meta.dirname, '../mock/a.controller.js'),
      path.join(import.meta.dirname, '../mock/b.controller.js'),
      path.join(import.meta.dirname, '../mock/d.controller.js'),
    ]);
  });

  it('should ignore .d.ts files during route discovery', () => {
    const injector = new Injector({
      providers: [[HonoService, { use: Hono }]],
    });

    const app = injector.inject(LatticeApp);
    app.config.dir = path.join(import.meta.dirname, '../mock');

    const controllers = app.findControllers();

    const hasDeclarationFiles = controllers.some((file) => file.endsWith('.d.ts'));
    assert.strictEqual(hasDeclarationFiles, false);
  });

  it('should use custom sort function from config', () => {
    const injector = new Injector({
      providers: [[HonoService, { use: Hono }]],
    });

    const app = injector.inject(LatticeApp);
    app.config.dir = path.join(import.meta.dirname, '../mock');

    app.config.transformPaths = (paths: string[]) => {
      return paths.toSorted((a, b) => b.localeCompare(a));
    };

    const controllers = app.findControllers();

    // With custom reverse alphabetical sort, expect: d.controller, c.middleware, b.controller, a.controller
    assert.deepEqual(controllers, [
      path.join(import.meta.dirname, '../mock/d.controller.js'),
      path.join(import.meta.dirname, '../mock/c.middleware.js'),
      path.join(import.meta.dirname, '../mock/b.controller.js'),
      path.join(import.meta.dirname, '../mock/a.controller.js'),
    ]);
  });

  it('should register controllers and middleware', async () => {
    const injector = new Injector({
      providers: [[HonoService, { use: Hono }]],
    });

    const app = injector.inject(LatticeApp);
    app.config.dir = path.join(import.meta.dirname, '../mock');
    const hono = injector.inject(HonoService);

    await app.registerRoutes();

    assert.deepEqual(
      hono.routes.map((r) => `${r.method} ${r.path}`),
      ['ALL /*', 'GET /a', 'GET /b', 'GET /d']
    );
  });

  it('should handle HTTP requests with correct responses and headers', async () => {
    const injector = new Injector({
      providers: [[HonoService, { use: Hono }]],
    });

    const app = injector.inject(LatticeApp);
    app.config.dir = path.join(import.meta.dirname, '../mock');
    const hono = injector.inject(HonoService);

    await app.registerRoutes();

    for (const path of ['/a', '/b', '/d']) {
      const response = await hono.request(path);
      assert.strictEqual(response.status, 200);
      assert.deepEqual(await response.json(), { message: `Controller ${path}` });
      assert.strictEqual(response.headers.get('middleware-c'), 'active');
    }
  });

  it('should register a controller from a string path', async () => {
    const injector = new Injector({
      providers: [[HonoService, { use: Hono }]],
    });

    const app = injector.inject(LatticeApp);

    await app.register(path.join(import.meta.dirname, '../mock/a.controller.js'));

    const hono = injector.inject(HonoService);
    assert.deepEqual(
      hono.routes.map((r) => `${r.method} ${r.path}`),
      ['GET /a']
    );
  });

  it('should register a controller from an InjectionToken', async () => {
    const injector = new Injector({
      providers: [[HonoService, { use: Hono }]],
    });

    const app = injector.inject(LatticeApp);

    const { default: ControllerA } = await import(
      path.join(import.meta.dirname, '../mock/a.controller.js')
    );

    await app.register(ControllerA);

    const hono = injector.inject(HonoService);

    assert.deepEqual(
      hono.routes.map((r) => `${r.method} ${r.path}`),
      ['GET /a']
    );
  });

  it('should call close on the HTTP server when LatticeApp.close is invoked', async () => {
    let closed = false;
    class CustomHttpServer extends TestHttpServer {
      override close() {
        closed = true;
        return Promise.resolve();
      }
    }

    const injector = new Injector({
      providers: [[HTTP_SERVER, { use: CustomHttpServer }]],
    });

    const app = injector.inject(LatticeApp);
    await app.serve({
      dir: path.join(import.meta.dirname, '/__fixtures_does_not_exist__'),
      port: 9091,
    });

    await app.close();
    assert.isTrue(closed);
  });

  it('HonoService should gracefully close the server if active, or resolve if not', async () => {
    const injector = new Injector();
    const honoService = injector.inject(HonoService);

    // Call close when not listening yet
    await honoService.close(); // should resolve cleanly

    // Listen on a random port
    const address = await honoService.listen(0);
    assert.isNotNull(address.port);

    // Close it gracefully
    await honoService.close();
  });

  it('should throw a descriptive error when a controller has no default export', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lattice-loader-test-'));
    const invalidControllerPath = path.join(tempDir, 'invalid.controller.js');
    
    // Write a file with no default export
    fs.writeFileSync(invalidControllerPath, 'export const foo = "bar";');

    try {
      const injector = new Injector({
        providers: [[HonoService, { use: Hono }]],
      });

      const app = injector.inject(LatticeApp);
      app.config.dir = tempDir;
      
      let error: any;
      try {
        await app.registerRoutes();
      } catch (err: any) {
        error = err;
      }

      assert.isDefined(error);
      assert.instanceOf(error, Error);
      assert.match(error.message, /Failed to load controller or middleware at/);
      assert.match(error.message, /Module has no default export/);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should register controllers in ascending order of their configured weights', async () => {
    const injector = new Injector({
      providers: [[HonoService, { use: Hono }]],
    });

    const app = injector.inject(LatticeApp);
    app.config.dir = path.join(import.meta.dirname, '../mock_weight');
    const hono = injector.inject(HonoService);

    await app.registerRoutes();

    assert.deepEqual(
      hono.routes.map((r) => `${r.method} ${r.path}`),
      ['GET /light', 'GET /heavy']
    );
  });
});
