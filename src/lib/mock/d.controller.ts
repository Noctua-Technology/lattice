import type { Context } from 'hono';

import { controller, get } from '../decorators.js';

@controller('/d')
export default class DController {
  @get()
  async getMessage(ctx: Context) {
    return ctx.json({ message: 'Controller /d' });
  }
}
