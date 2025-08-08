import type { Context } from 'hono';

import { controller, get } from '../decorators.js';

@controller('/a')
export default class AController {
  @get()
  async getMessage(ctx: Context) {
    return ctx.json({ message: 'Controller /a' });
  }
}
