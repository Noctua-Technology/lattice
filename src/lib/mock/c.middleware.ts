import type { Context, Next } from 'hono';

import { controller, use } from '../decorators.js';

@controller()
export default class CMiddleware {
  @use('*')
  async addHeader(ctx: Context, next: Next) {
    ctx.header('middleware-c', 'active');
    await next();
  }
}
