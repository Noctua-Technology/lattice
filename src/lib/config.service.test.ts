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
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { LatticeConfigService } from '#lib/config.service.js';

async function createConfigFile(
  dirPath: string,
  config: object | string,
  fileName = 'lattice.config.json'
) {
  const configPath = path.join(dirPath, fileName);
  const contents = typeof config === 'string' ? config : JSON.stringify(config);

  await fs.writeFile(configPath, contents);

  return configPath;
}

describe('config.service', () => {
  it('findConfigFile should find lattice.config.json in the given directory', async () => {
    await using tmpDir = await fs.mkdtempDisposable(path.join(os.tmpdir(), 'lattice-test-'));
    const configPath = await createConfigFile(tmpDir.path, { port: 3000 });

    const service = new Injector().inject(LatticeConfigService);

    assert.strictEqual(await service.findConfigFile(tmpDir.path), configPath);
  });

  it('findConfigFile should walk up the directory tree to find a config file', async () => {
    await using tmpDir = await fs.mkdtempDisposable(path.join(os.tmpdir(), 'lattice-test-'));

    const subDir = path.join(tmpDir.path, 'sub', 'dir');
    await fs.mkdir(subDir, { recursive: true });

    const configPath = await createConfigFile(tmpDir.path, { port: 8080 });

    const service = new Injector().inject(LatticeConfigService);

    assert.strictEqual(await service.findConfigFile(subDir), configPath);
  });

  it('findConfigFile should return null when no config file exists', async () => {
    await using tmpDir = await fs.mkdtempDisposable(path.join(os.tmpdir(), 'lattice-test-'));

    const service = new Injector().inject(LatticeConfigService);

    assert.isNull(await service.findConfigFile(tmpDir.path));
  });

  it('readConfig should parse a JSON config file', async () => {
    await using tmpDir = await fs.mkdtempDisposable(path.join(os.tmpdir(), 'lattice-test-'));

    const expected = { port: 4000, dir: '/app' };
    const configPath = await createConfigFile(tmpDir.path, expected);

    const service = new Injector().inject(LatticeConfigService);
    const config = await service.readConfig(configPath);

    assert.deepEqual(config, expected);
  });

  it('readConfig should import a JS module config file', async () => {
    const service = new Injector().inject(LatticeConfigService);

    const config = await service.readConfig(
      path.join(import.meta.dirname, '../mock/lattice.config.js')
    );

    assert.deepEqual(config, { port: 3000 });
  });

  it('readConfig should throw when JSON config shape is invalid', async () => {
    await using tmpDir = await fs.mkdtempDisposable(path.join(os.tmpdir(), 'lattice-test-'));

    const configPath = await createConfigFile(tmpDir.path, { port: '3000' });

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
    await using tmpDir = await fs.mkdtempDisposable(path.join(os.tmpdir(), 'lattice-test-'));

    const configPath = await createConfigFile(tmpDir.path, { port: 3000.5 });

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
    await using tmpDir = await fs.mkdtempDisposable(path.join(os.tmpdir(), 'lattice-test-'));

    const configPath = await createConfigFile(tmpDir.path, { port: 70000 });

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
    await using tmpDir = await fs.mkdtempDisposable(path.join(os.tmpdir(), 'lattice-test-'));

    const expected = { port: 1 };
    const configPath = await createConfigFile(tmpDir.path, expected);

    const service = new Injector().inject(LatticeConfigService);
    const config = await service.readConfig(configPath);

    assert.deepEqual(config, expected);
  });

  it('readConfig should accept JSON port at the upper boundary', async () => {
    await using tmpDir = await fs.mkdtempDisposable(path.join(os.tmpdir(), 'lattice-test-'));

    const expected = { port: 65535 };
    const configPath = await createConfigFile(tmpDir.path, expected);

    const service = new Injector().inject(LatticeConfigService);
    const config = await service.readConfig(configPath);

    assert.deepEqual(config, expected);
  });

  it('readConfig should accept JS config port at the upper boundary', async () => {
    await using tmpDir = await fs.mkdtempDisposable(path.join(os.tmpdir(), 'lattice-test-'));

    const configPath = await createConfigFile(
      tmpDir.path,
      'export default { port: 65535 };',
      'lattice.config.js'
    );

    const service = new Injector().inject(LatticeConfigService);
    const config = await service.readConfig(configPath);

    assert.deepEqual(config, { port: 65535 });
  });

  it('readConfig should allow JS config with unknown keys', async () => {
    await using tmpDir = await fs.mkdtempDisposable(path.join(os.tmpdir(), 'lattice-test-'));

    const configPath = await createConfigFile(
      tmpDir.path,
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
    await using tmpDir = await fs.mkdtempDisposable(path.join(os.tmpdir(), 'lattice-test-'));

    const service = new Injector().inject(LatticeConfigService);

    assert.deepEqual(await service.load(tmpDir.path), {});
  });

  it('load should use process.cwd() as default directory when omitted', async () => {
    const service = new Injector().inject(LatticeConfigService);
    const config = await service.load();

    assert.isObject(config);
  });

  it('load should find and parse a config file', async () => {
    await using tmpDir = await fs.mkdtempDisposable(path.join(os.tmpdir(), 'lattice-test-'));

    const expected = { port: 5000 };
    await createConfigFile(tmpDir.path, expected);

    const service = new Injector().inject(LatticeConfigService);
    const config = await service.load(tmpDir.path);

    assert.deepEqual(config, expected);
  });
});
