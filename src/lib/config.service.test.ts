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
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { LatticeConfigService } from '#lib/config.service.js';

describe('config.service', () => {
  it('findConfigFile should find lattice.config.json in the given directory', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lattice-test-'));

    try {
      const configPath = path.join(tmpDir, 'lattice.config.json');
      fs.writeFileSync(configPath, JSON.stringify({ port: 3000 }));

      const service = new Injector().inject(LatticeConfigService);

      assert.strictEqual(service.findConfigFile(tmpDir), configPath);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('findConfigFile should walk up the directory tree to find a config file', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lattice-test-'));

    try {
      const subDir = path.join(tmpDir, 'sub', 'dir');
      fs.mkdirSync(subDir, { recursive: true });

      const configPath = path.join(tmpDir, 'lattice.config.json');
      fs.writeFileSync(configPath, JSON.stringify({ port: 8080 }));

      const service = new Injector().inject(LatticeConfigService);

      assert.strictEqual(service.findConfigFile(subDir), configPath);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('findConfigFile should return null when no config file exists', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lattice-test-'));

    try {
      const service = new Injector().inject(LatticeConfigService);

      assert.isNull(service.findConfigFile(tmpDir));
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('readConfig should parse a JSON config file', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lattice-test-'));

    try {
      const configPath = path.join(tmpDir, 'lattice.config.json');
      const expected = { port: 4000, dir: '/app' };
      fs.writeFileSync(configPath, JSON.stringify(expected));

      const service = new Injector().inject(LatticeConfigService);
      const config = await service.readConfig(configPath);

      assert.deepEqual(config, expected);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('readConfig should import a JS module config file', async () => {
    const service = new Injector().inject(LatticeConfigService);

    const config = await service.readConfig(
      path.join(import.meta.dirname, '/mock/lattice.config.js')
    );

    assert.deepEqual(config, { port: 3000 });
  });

  it('readConfig should throw when JSON config shape is invalid', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lattice-test-'));

    try {
      const configPath = path.join(tmpDir, 'lattice.config.json');
      fs.writeFileSync(configPath, JSON.stringify({ port: '3000' }));

      const service = new Injector().inject(LatticeConfigService);
      let error: unknown;

      try {
        await service.readConfig(configPath);
      } catch (e) {
        error = e;
      }

      assert.instanceOf(error, Error);
      assert.match((error as Error).message, /Invalid lattice config/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('readConfig should throw when JSON port is not an integer', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lattice-test-'));

    try {
      const configPath = path.join(tmpDir, 'lattice.config.json');
      fs.writeFileSync(configPath, JSON.stringify({ port: 3000.5 }));

      const service = new Injector().inject(LatticeConfigService);
      let error: unknown;

      try {
        await service.readConfig(configPath);
      } catch (e) {
        error = e;
      }

      assert.instanceOf(error, Error);
      assert.match((error as Error).message, /Invalid lattice config/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('readConfig should throw when JSON port is out of valid range', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lattice-test-'));

    try {
      const configPath = path.join(tmpDir, 'lattice.config.json');
      fs.writeFileSync(configPath, JSON.stringify({ port: 70000 }));

      const service = new Injector().inject(LatticeConfigService);
      let error: unknown;

      try {
        await service.readConfig(configPath);
      } catch (e) {
        error = e;
      }

      assert.instanceOf(error, Error);
      assert.match((error as Error).message, /Invalid lattice config/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('readConfig should accept JSON port at the lower boundary', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lattice-test-'));

    try {
      const configPath = path.join(tmpDir, 'lattice.config.json');
      const expected = { port: 1 };
      fs.writeFileSync(configPath, JSON.stringify(expected));

      const service = new Injector().inject(LatticeConfigService);
      const config = await service.readConfig(configPath);

      assert.deepEqual(config, expected);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('readConfig should accept JSON port at the upper boundary', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lattice-test-'));

    try {
      const configPath = path.join(tmpDir, 'lattice.config.json');
      const expected = { port: 65535 };
      fs.writeFileSync(configPath, JSON.stringify(expected));

      const service = new Injector().inject(LatticeConfigService);
      const config = await service.readConfig(configPath);

      assert.deepEqual(config, expected);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('readConfig should accept JS config port at the upper boundary', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lattice-test-'));

    try {
      const configPath = path.join(tmpDir, 'lattice.config.js');
      fs.writeFileSync(configPath, 'export default { port: 65535 };');

      const service = new Injector().inject(LatticeConfigService);
      const config = await service.readConfig(configPath);

      assert.deepEqual(config, { port: 65535 });
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('readConfig should allow JS config with unknown keys', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lattice-test-'));

    try {
      const configPath = path.join(tmpDir, 'lattice.config.js');
      fs.writeFileSync(
        configPath,
        'export default { port: 3000, appName: "my-app", featureFlags: { beta: true } };'
      );

      const service = new Injector().inject(LatticeConfigService);
      const config = await service.readConfig(configPath);

      assert.deepEqual(config, {
        port: 3000,
        appName: 'my-app',
        featureFlags: { beta: true },
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('load should return an empty object when no config file is found', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lattice-test-'));

    try {
      const service = new Injector().inject(LatticeConfigService);

      assert.deepEqual(await service.load(tmpDir), {});
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('load should find and parse a config file', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lattice-test-'));

    try {
      const expected = { port: 5000 };
      fs.writeFileSync(path.join(tmpDir, 'lattice.config.json'), JSON.stringify(expected));

      const service = new Injector().inject(LatticeConfigService);
      const config = await service.load(tmpDir);

      assert.deepEqual(config, expected);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});
