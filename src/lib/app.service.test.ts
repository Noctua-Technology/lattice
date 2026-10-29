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
import fs from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { LatticeApp } from '#lib/app.service.js';
import { HonoService } from '#lib/hono.service.js';
import { HTTP_SERVER, type HttpHandler, type HttpServer } from '#lib/http.service.js';
import { ENV, FS } from '#lib/services.js';

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

  it('should find controllers and sort them so that all middleware are registered first', async () => {
    const injector = new Injector();

    const app = injector.inject(LatticeApp);
    app.config.dir = path.join(import.meta.dirname, '../mock');

    const controllers = await app.findControllers();

    assert.deepEqual(controllers, [
      path.join(import.meta.dirname, '../mock/c.middleware.js'),
      path.join(import.meta.dirname, '../mock/a.controller.js'),
      path.join(import.meta.dirname, '../mock/b.controller.js'),
      path.join(import.meta.dirname, '../mock/d.controller.js'),
    ]);
  });

  it('should ignore .d.ts files during route discovery', async () => {
    const injector = new Injector();

    const app = injector.inject(LatticeApp);
    app.config.dir = path.join(import.meta.dirname, '../mock');

    const controllers = await app.findControllers();

    const hasDeclarationFiles = controllers.some((file) => file.endsWith('.d.ts'));
    assert.strictEqual(hasDeclarationFiles, false);
  });

  it('should use custom sort function from config', async () => {
    const injector = new Injector();

    const app = injector.inject(LatticeApp);
    app.config.dir = path.join(import.meta.dirname, '../mock');

    app.config.transformPaths = (paths: string[]) => {
      return paths.toSorted((a, b) => b.localeCompare(a));
    };

    const controllers = await app.findControllers();

    // With custom reverse alphabetical sort, expect: d.controller, c.middleware, b.controller, a.controller
    assert.deepEqual(controllers, [
      path.join(import.meta.dirname, '../mock/d.controller.js'),
      path.join(import.meta.dirname, '../mock/c.middleware.js'),
      path.join(import.meta.dirname, '../mock/b.controller.js'),
      path.join(import.meta.dirname, '../mock/a.controller.js'),
    ]);
  });

  it('should register controllers and middleware', async () => {
    const injector = new Injector();

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
    const injector = new Injector();

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
    const injector = new Injector();

    const app = injector.inject(LatticeApp);

    await app.register(path.join(import.meta.dirname, '../mock/a.controller.js'));

    const hono = injector.inject(HonoService);
    assert.deepEqual(
      hono.routes.map((r) => `${r.method} ${r.path}`),
      ['GET /a']
    );
  });

  it('should register a controller from an InjectionToken', async () => {
    const injector = new Injector();

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
    await using tempDir = await fs.mkdtempDisposable(
      path.join(os.tmpdir(), 'lattice-loader-test-')
    );
    const invalidControllerPath = path.join(tempDir.path, 'invalid.controller.js');

    // Write a file with no default export
    await fs.writeFile(invalidControllerPath, 'export const foo = "bar";');

    const injector = new Injector();

    const app = injector.inject(LatticeApp);
    app.config.dir = tempDir.path;

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
  });

  it('should register controllers in ascending order of their configured weights', async () => {
    const injector = new Injector();

    const app = injector.inject(LatticeApp);
    app.config.dir = path.join(import.meta.dirname, '../mock_weight');
    const hono = injector.inject(HonoService);

    await app.registerRoutes();

    assert.deepEqual(
      hono.routes.map((r) => `${r.method} ${r.path}`),
      ['GET /light', 'GET /heavy']
    );
  });

  it('should resolve ENV and FS tokens with process.env and fs', () => {
    const injector = new Injector();
    const resolvedEnv = injector.inject(ENV);
    const resolvedFs = injector.inject(FS);

    assert.strictEqual(resolvedEnv, process.env);
    assert.strictEqual(resolvedFs, fs);
  });

  it('should sort controllers when a.controller is matched before c.middleware', async () => {
    const mockFs = {
      // Mock the async iterator returned by node:fs/promises glob
      glob: async function* () {
        yield 'a.controller.js';
        yield 'c.middleware.js';
      },
    };

    const injector = new Injector({
      providers: [[FS, { factory: () => mockFs as any }]],
    });

    const app = injector.inject(LatticeApp);
    const controllers = await app.findControllers();

    // c.middleware.js should still be sorted first, proving the `!a.includes('middleware') && b.includes('middleware')` branch was hit.
    assert.deepEqual(controllers, ['c.middleware.js', 'a.controller.js']);
  });

  it('HonoService should reject when close is called twice on an active server', async () => {
    const injector = new Injector();
    const honoService = injector.inject(HonoService);

    await honoService.listen(0);
    await honoService.close();

    let error: any;
    try {
      await honoService.close();
    } catch (err) {
      error = err;
    }
    assert.isDefined(error);
    assert.match(error.message, /Server is not running/);
  });

  it('should give precedence to programmatic config over loaded config in serve', async () => {
    const injector = new Injector({
      providers: [[HTTP_SERVER, { use: TestHttpServer }]],
    });

    const app = injector.inject(LatticeApp);
    const httpServer = injector.inject(HTTP_SERVER) as TestHttpServer;

    // mock/lattice.config.js specifies port: 3000
    await app.serve({
      dir: path.join(import.meta.dirname, '../mock'),
      port: 9090,
    });

    assert.strictEqual(app.config.port, 9090);
    assert.strictEqual(httpServer.listenPort, 9090);
  });

  it('should preserve pre-configured app.config properties when serve is called', async () => {
    const injector = new Injector({
      providers: [[HTTP_SERVER, { use: TestHttpServer }]],
    });

    const app = injector.inject(LatticeApp);
    app.config.globs = ['custom-glob'];

    await app.serve({
      dir: path.join(import.meta.dirname, '/__fixtures_does_not_exist__'),
      port: 9090,
    });

    assert.deepEqual(app.config.globs, ['custom-glob']);
  });

  it('should deduplicate .js and .ts files preferring .js', async () => {
    await using tempDir = await fs.mkdtempDisposable(path.join(os.tmpdir(), 'lattice-dedup-test-'));

    await fs.writeFile(
      path.join(tempDir.path, 'item.controller.ts'),
      'export default class ItemTs {}'
    );
    await fs.writeFile(
      path.join(tempDir.path, 'item.controller.js'),
      'export default class ItemJs {}'
    );

    const injector = new Injector();

    const app = injector.inject(LatticeApp);
    app.config.dir = tempDir.path;

    const controllers = await app.findControllers();
    assert.strictEqual(controllers.length, 1);
    assert.strictEqual(controllers[0], path.join(tempDir.path, 'item.controller.js'));
  });

  it('should ignore files inside node_modules during route discovery', async () => {
    await using tempDir = await fs.mkdtempDisposable(
      path.join(os.tmpdir(), 'lattice-nodemodules-test-')
    );

    const nmDir = path.join(tempDir.path, 'node_modules', 'dep');

    await fs.mkdir(nmDir, { recursive: true });
    await fs.writeFile(path.join(nmDir, 'dep.controller.js'), 'export default class DepCtrl {}');
    await fs.writeFile(
      path.join(tempDir.path, 'app.controller.js'),
      'export default class AppCtrl {}'
    );

    const injector = new Injector();

    const app = injector.inject(LatticeApp);
    app.config.dir = tempDir.path;

    const controllers = await app.findControllers();

    assert.deepEqual(controllers, [path.join(tempDir.path, 'app.controller.js')]);
  });

  it('should provide actionable error when loading .ts file without a loader', async () => {
    await using tempDir = await fs.mkdtempDisposable(
      path.join(os.tmpdir(), 'lattice-ts-error-test-')
    );

    // Writing a TS file with decorator syntax that Node ESM cannot parse natively
    await fs.writeFile(
      path.join(tempDir.path, 'syntax.controller.ts'),
      '@controller()\nexport default class SyntaxController {}'
    );

    const injector = new Injector();

    const app = injector.inject(LatticeApp);
    app.config.dir = tempDir.path;

    let error: any;
    try {
      await app.registerRoutes();
    } catch (err: any) {
      error = err;
    }

    assert.isDefined(error);
    assert.instanceOf(error, Error);
    assert.match(error.message, /Direct execution of \.ts files requires a loader/);
  });

  it('should register middleware before controllers even when a controller has negative weight', async () => {
    const injector = new Injector();

    const app = injector.inject(LatticeApp);
    // Globs including c.middleware.js and light.controller.js (which has weight: -10)
    app.config.globs = [
      path.join(import.meta.dirname, '../mock/c.middleware.js'),
      path.join(import.meta.dirname, '../mock_weight/light.controller.js'),
    ];

    const hono = injector.inject(HonoService);
    await app.registerRoutes();

    assert.deepEqual(
      hono.routes.map((r) => `${r.method} ${r.path}`),
      ['ALL /*', 'GET /light']
    );

    const res = await hono.request('/light');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('middleware-c'), 'active');
  });
});
