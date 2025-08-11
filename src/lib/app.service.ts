import { serve } from '@hono/node-server';
import { inject, injectable, Injector, StaticToken } from '@joist/di';
import type { AddressInfo } from 'node:net';
import path from 'node:path';

import { HonoService } from './hono.service.js';
import { FS } from './services.js';

export interface AppConfig {
  glob?: string;
  port?: number;
  transformPaths?: (paths: string[]) => string[];
}

export const LATTICE_CONFIG = new StaticToken<AppConfig>('APP_CONFIG', () => {
  return {};
});

@injectable({
  name: 'LatticeApp',
})
export class LatticeApp {
  #fs = inject(FS);
  #injector = inject(Injector);
  #hono = inject(HonoService);
  #config = inject(LATTICE_CONFIG);

  async serve() {
    const hono = this.#hono();
    const { port = 8080 } = this.#config();

    await this.registerRoutes();

    return new Promise<AddressInfo>((resolve) => {
      serve({ fetch: hono.fetch, port }, resolve);
    });
  }

  async registerRoutes() {
    const injector = this.#injector();
    const controllerPaths = this.findControllers();

    const controllers = await Promise.all(
      controllerPaths.map((file) => import(file).then((m) => m.default))
    );

    for (const controller of controllers) {
      injector.inject(controller);
    }
  }

  findControllers(): string[] {
    const fs = this.#fs();
    const { glob = '**/*.{controller,middleware}.js', transformPaths = sortControllers } =
      this.#config();

    return transformPaths(fs.globSync(path.join(process.cwd(), glob)));
  }
}

function sortControllers(paths: string[]) {
  return paths.toSorted((a, b) => {
    if (a.includes('middleware') && !b.includes('middleware')) {
      return -1;
    }

    if (!a.includes('middleware') && b.includes('middleware')) {
      return 1;
    }

    return 0;
  });
}
