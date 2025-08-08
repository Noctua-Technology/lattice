import type { Context } from 'hono';

import { controller, get } from '../decorators.js';

@controller('/b')
export default class BController {
  @get()
  async getMessage(ctx: Context) {
    return ctx.json({ message: 'Controller /b' });
  }
}
