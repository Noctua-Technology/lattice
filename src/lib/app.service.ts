import { serve } from '@hono/node-server';
import { inject, injectable, Injector } from '@joist/di';
import type { AddressInfo } from 'node:net';
import path from 'node:path';

import { HonoService } from './hono.service.js';
import { ENV, FS } from './services.js';

@injectable({
  name: 'LatticeApp',
})
export class LatticeApp {
  #fs = inject(FS);
  #injector = inject(Injector);
  #hono = inject(HonoService);
  #env = inject(ENV);

  async serve() {
    const env = this.#env();
    const hono = this.#hono();

    await this.registerRoutes();

    return new Promise<AddressInfo>((resolve) => {
      serve({ fetch: hono.fetch, port: Number(env.PORT) || 8080 }, resolve);
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

    return sortControllers(
      fs.globSync(path.join(process.cwd(), '**/*.{controller,middleware}.js'))
    );
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
