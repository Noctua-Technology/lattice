import { injectable } from '@joist/di';
import { Hono } from 'hono';
import { compress } from 'hono/compress';
import { trimTrailingSlash } from 'hono/trailing-slash';

@injectable({
  name: 'HonoService',
})
export class HonoService extends Hono {
  constructor() {
    super({});

    this.use(compress());
    this.use(trimTrailingSlash());
  }
}
