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

class TempDir {
  path: string;

  constructor() {
    this.path = fs.mkdtempSync(path.join(os.tmpdir(), 'lattice-test-'));
  }

  createConfigFile(config: object | string, fileName = 'lattice.config.json') {
    const configPath = path.join(this.path, fileName);
    const contents = typeof config === 'string' ? config : JSON.stringify(config);

    fs.writeFileSync(configPath, contents);

    return configPath;
  }

  [Symbol.dispose]() {
    fs.rmSync(this.path, { recursive: true });
  }
}

describe('config.service', () => {
  it('findConfigFile should find lattice.config.json in the given directory', () => {
    using tmpDir = new TempDir();
    const configPath = tmpDir.createConfigFile({ port: 3000 });

    const service = new Injector().inject(LatticeConfigService);

    assert.strictEqual(service.findConfigFile(tmpDir.path), configPath);
  });

  it('findConfigFile should walk up the directory tree to find a config file', () => {
    using tmpDir = new TempDir();

    const subDir = path.join(tmpDir.path, 'sub', 'dir');
    fs.mkdirSync(subDir, { recursive: true });

    const configPath = tmpDir.createConfigFile({ port: 8080 });

    const service = new Injector().inject(LatticeConfigService);

    assert.strictEqual(service.findConfigFile(subDir), configPath);
  });

  it('findConfigFile should return null when no config file exists', () => {
    using tmpDir = new TempDir();

    const service = new Injector().inject(LatticeConfigService);

    assert.isNull(service.findConfigFile(tmpDir.path));
  });

  it('readConfig should parse a JSON config file', async () => {
    using tmpDir = new TempDir();

    const expected = { port: 4000, dir: '/app' };
    const configPath = tmpDir.createConfigFile(expected);

    const service = new Injector().inject(LatticeConfigService);
    const config = await service.readConfig(configPath);

    assert.deepEqual(config, expected);
  });

  it('readConfig should import a JS module config file', async () => {
    const service = new Injector().inject(LatticeConfigService);

    const config = await service.readConfig(
      path.join(import.meta.dirname, '/mock/lattice.config.js')
    );

    assert.deepEqual(config, { port: 3000 });
  });

  it('readConfig should throw when JSON config shape is invalid', async () => {
    using tmpDir = new TempDir();

    const configPath = tmpDir.createConfigFile({ port: '3000' });

    const service = new Injector().inject(LatticeConfigService);
    let error: unknown;

    try {
      await service.readConfig(configPath);
    } catch (e) {
      error = e;
    }

    assert.instanceOf(error, Error);
    assert.match((error as Error).message, /Invalid lattice config/);
  });

  it('readConfig should throw when JSON port is not an integer', async () => {
    using tmpDir = new TempDir();

    const configPath = tmpDir.createConfigFile({ port: 3000.5 });

    const service = new Injector().inject(LatticeConfigService);
    let error: unknown;

    try {
      await service.readConfig(configPath);
    } catch (e) {
      error = e;
    }

    assert.instanceOf(error, Error);
    assert.match((error as Error).message, /Invalid lattice config/);
  });

  it('readConfig should throw when JSON port is out of valid range', async () => {
    using tmpDir = new TempDir();

    const configPath = tmpDir.createConfigFile({ port: 70000 });

    const service = new Injector().inject(LatticeConfigService);
    let error: unknown;

    try {
      await service.readConfig(configPath);
    } catch (e) {
      error = e;
    }

    assert.instanceOf(error, Error);
    assert.match((error as Error).message, /Invalid lattice config/);
  });

  it('readConfig should accept JSON port at the lower boundary', async () => {
    using tmpDir = new TempDir();

    const expected = { port: 1 };
    const configPath = tmpDir.createConfigFile(expected);

    const service = new Injector().inject(LatticeConfigService);
    const config = await service.readConfig(configPath);

    assert.deepEqual(config, expected);
  });

  it('readConfig should accept JSON port at the upper boundary', async () => {
    using tmpDir = new TempDir();

    const expected = { port: 65535 };
    const configPath = tmpDir.createConfigFile(expected);

    const service = new Injector().inject(LatticeConfigService);
    const config = await service.readConfig(configPath);

    assert.deepEqual(config, expected);
  });

  it('readConfig should accept JS config port at the upper boundary', async () => {
    using tmpDir = new TempDir();

    const configPath = tmpDir.createConfigFile(
      'export default { port: 65535 };',
      'lattice.config.js'
    );

    const service = new Injector().inject(LatticeConfigService);
    const config = await service.readConfig(configPath);

    assert.deepEqual(config, { port: 65535 });
  });

  it('readConfig should allow JS config with unknown keys', async () => {
    using tmpDir = new TempDir();

    const configPath = tmpDir.createConfigFile(
      'export default { port: 3000, appName: "my-app", featureFlags: { beta: true } };',
      'lattice.config.js'
    );

    const service = new Injector().inject(LatticeConfigService);
    const config = await service.readConfig(configPath);

    assert.deepEqual(config, {
      port: 3000,
      appName: 'my-app',
      featureFlags: { beta: true },
    });
  });

  it('load should return an empty object when no config file is found', async () => {
    using tmpDir = new TempDir();

    const service = new Injector().inject(LatticeConfigService);

    assert.deepEqual(await service.load(tmpDir.path), {});
  });

  it('load should find and parse a config file', async () => {
    using tmpDir = new TempDir();

    const expected = { port: 5000 };
    tmpDir.createConfigFile(expected);

    const service = new Injector().inject(LatticeConfigService);
    const config = await service.load(tmpDir.path);

    assert.deepEqual(config, expected);
  });
});
