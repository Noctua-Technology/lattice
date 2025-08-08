# @noctuatech/lattice

A lightweight web framework built on top of Hono with dependency injection and decorator-based routing.

## Overview

The Lattice framework provides a simple and powerful way to build web applications using TypeScript decorators and dependency injection. It's built on top of Hono for fast, lightweight HTTP handling.

## Core Features

- **Decorator-based routing** - Use `@get`, `@post`, `@use` decorators for clean route definitions
- **Dependency injection** - Built-in DI support using `@joist/di`
- **Automatic route registration** - Controllers are automatically discovered and registered
- **Middleware support** - Easy middleware integration with `@use` decorator
- **TypeScript-first** - Full TypeScript support with type safety

## Quick Start

### Basic Controller

```typescript
// hello.controller.ts
import { controller, get } from '@tcd/framework';
import type { Context } from 'hono';

@controller()
export default class HelloController {
  @get('/hello')
  async sayHello(ctx: Context) {
    return ctx.json({ message: 'Hello, World!' });
  }
}

// main.ts
const root = new Injector();
const app = root.inject(AppService);

await app.serve();
```

### Controller with Base Path

```typescript
import { controller, get, post } from '@tcd/framework';
import type { Context } from 'hono';

@controller('/api/users')
export default class UserController {
  @get('/')
  async getUsers(ctx: Context) {
    return ctx.json({ users: [] });
  }

  @post('/')
  async createUser(ctx: Context) {
    const body = await ctx.req.json();
    return ctx.json({ user: body }, 201);
  }
}
```

## Decorators

### `@controller(path?, opts?)`

Marks a class as a controller and optionally sets a base path for all routes in the controller.

**Parameters:**

- `path` (optional): Base path for all routes in this controller
- `opts` (optional): Dependency injection options

**Example:**

```typescript
@controller('/api/v1') // All routes will be prefixed with /api/v1
export default class ApiController {
  // Routes will be: /api/v1/users, /api/v1/posts, etc.
}
```

### `@get(path, condition?)`

Registers a GET route handler.

**Parameters:**

- `path`: Route path (relative to controller base path)
- `condition` (optional): Lifecycle condition for dependency injection

**Example:**

```typescript
@get('/users/:id')
async getUser(ctx: Context) {
  const id = ctx.req.param('id');
  return ctx.json({ id, name: 'John Doe' });
}
```

### `@post(path, condition?)`

Registers a POST route handler.

**Parameters:**

- `path`: Route path (relative to controller base path)
- `condition` (optional): Lifecycle condition for dependency injection

**Example:**

```typescript
@post('/users')
async createUser(ctx: Context) {
  const body = await ctx.req.json();
  return ctx.json({ user: body }, 201);
}
```

### `@use(path, condition?)`

Registers middleware for the specified path pattern.

**Parameters:**

- `path`: Path pattern (e.g., `'*'` for all routes, `'/api/*'` for API routes)
- `condition` (optional): Lifecycle condition for dependency injection

**Example:**

```typescript
@use('*')
async logger(ctx: Context, next: Next) {
  console.log(`${ctx.req.method} ${ctx.req.path}`);
  await next();
  console.log(`Response: ${ctx.res.status}`);
}
```

## Dependency Injection

Controllers support dependency injection using `@joist/di`. You can inject services and other dependencies:

```typescript
import { inject } from '@joist/di';
import { controller, get } from '@noctuatech/lattice';

import { UserService } from '#services/user.service.js';

@controller('/api/users')
export default class UserController {
  #userService = inject(UserService);

  @get('/')
  async getUsers(ctx: Context) {
    const userService = this.#userService();
    const users = await userService.getAll();
    return ctx.json({ users });
  }
}
```

## Middleware

### Global Middleware

Create middleware controllers that apply to all routes:

```typescript
import { controller, use } from '@noctuatech/lattice';
import type { Context, Next } from 'hono';

@controller()
export default class LoggerMiddleware {
  @use('*')
  async logRequests(ctx: Context, next: Next) {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;

    console.log(`${ctx.req.method} ${ctx.req.path} - ${ctx.res.status} (${duration}ms)`);
  }
}
```

### Conditional Middleware

Use lifecycle conditions to enable/disable middleware based on environment or configuration:

```typescript
@controller()
export default class AuthMiddleware {
  @use('*', () => {
    return {
      enabled: process.env.NODE_ENV !== 'development',
    };
  })
  async requireAuth(ctx: Context, next: Next) {
    // Only runs in non-development environments
    const token = ctx.req.header('Authorization');
    if (!token) {
      return ctx.json({ error: 'Unauthorized' }, 401);
    }
    return next();
  }
}
```

## Route Patterns

The framework supports various route patterns:

```typescript
@controller('/api')
export default class ApiController {
  // Static routes
  @get('/users')
  async getUsers(ctx: Context) {
    /* ... */
  }

  // Parameter routes
  @get('/users/:id')
  async getUser(ctx: Context) {
    const id = ctx.req.param('id');
    // ...
  }

  // Wildcard routes
  @get('*')
  async catchAll(ctx: Context) {
    return ctx.json({ error: 'Not found' }, 404);
  }

  // Nested parameter routes
  @get('/users/:userId/posts/:postId')
  async getUserPost(ctx: Context) {
    const userId = ctx.req.param('userId');
    const postId = ctx.req.param('postId');
    // ...
  }
}
```

## Testing Controllers

Controllers can be easily tested using the framework's testing utilities:

```typescript
import { HonoService } from '@noctuatech/lattice';
import { Injector } from '@joist/di';
import { assert } from 'chai';
import { test } from 'node:test';

import UserController from './user.controller.js';

test('UserController', async () => {
  const testbed = new Injector();

  const hono = testbed.inject(HonoService);
  const controller = testbed.inject(UserController);

  assert.instanceOf(controller, UserController);

  const response = await hono.request('/api/users');
  assert.strictEqual(response.status, 200);
});
```

## File Naming Convention

Controllers are automatically discovered by the framework. Follow these naming conventions:

- **Controllers**: Files ending with `.controller.ts`
- **Middleware**: Files ending with `.middleware.ts`

Example file structure:

```
src/
├── routes/
│   ├── users/
│   │   └── user.controller.ts
│   └── posts/
│       └── post.controller.ts
└── middleware/
    ├── auth.middleware.ts
    └── logger.middleware.ts
```

## Best Practices

1. **Use descriptive controller names**: `UserController`, `PostController`, etc.
2. **Group related routes**: Use base paths to organize related endpoints
3. **Keep controllers focused**: Each controller should handle a specific resource or feature
4. **Use dependency injection**: Inject services rather than importing them directly
5. **Handle errors gracefully**: Return appropriate HTTP status codes and error messages
6. **Write tests**: Test your controllers to ensure they work correctly

## Dependencies

- `hono`: Fast, lightweight web framework
- `@joist/di`: Dependency injection container
- `@hono/node-server`: Node.js server adapter for Hono
