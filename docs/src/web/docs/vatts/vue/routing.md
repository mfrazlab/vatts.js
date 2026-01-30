# Routing in Vatts.js - Vue

Vatts.js has a flexible routing system for both **frontend** and **backend**. This guide explains how routes work, how to create route files, and what patterns you can use.

---

## Routing Strategies

Vatts provides two routing strategies for the frontend:

1.  **RouteConfig (Default)**: This strategy is based on explicitly defining route configurations in files located in `/src/web/routes`. Each file exports a `RouteConfig` object that specifies the URL pattern and the component to render.
2.  **PathRouter (File-based)**: This is an alternative, file-system-based routing strategy. When `pathRouter: true` is set in your `vatts.config.ts` (or `.js`), Vatts will automatically create routes based on the file structure in `/src/web/`. For example, `/src/web/page.vue` maps to the `/` route, and `/src/web/blog/[id]/page.vue` maps to the `/blog/:id` route.

This guide primarily focuses on the `RouteConfig` strategy. For more details on `pathRouter`, see the file-based routing section below.

---

## Frontend Routes with `RouteConfig`

When using the default `RouteConfig` strategy, frontend routes live in `/src/web/routes`.

> Important: **creating a route file is not enough by itself**.
>
> Unlike fully file-based frameworks, in Vatts.js you typically **must register your routes** so they become active.

### Basic Route

The simplest route exports a `RouteConfig` with a `pattern` and a `component`. You can use `.vue` files.

```vue
<script lang="ts">
   import type { RouteConfig } from "vatts/vue";

   export const config: RouteConfig = {
      pattern: '/',
      component: undefined,
      generateMetadata: () => ({
         title: 'Vatts.js | Home'
      })
   };
</script>
<template>
   <div class="flex min-h-screen flex-col items-center justify-center bg-gray-950 p-4 text-center">
      <div class="group relative">
         <div class="absolute -inset-1 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-400 opacity-25 blur transition duration-500 group-hover:opacity-50"></div>
         <div class="relative rounded-lg bg-gray-900 px-8 py-6 ring-1 ring-gray-800">
            <h1 class="mb-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">
               Hello <span class="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">World</span>
            </h1>

            <p class="text-sm font-medium text-gray-400">
               Running with <span class="text-gray-200">Vatts.js</span>
            </p>
         </div>
      </div>
   </div>
</template>
```

### Dynamic Routes

Vatts.js supports several kinds of dynamic params in the `pattern`:

| Pattern        | Example File | Matches                | Does Not Match |
|----------------|--------------|------------------------|----------------|
| `[param]`      | `id.vue`     | `/1`, `/2`             | `/`, `/1/2`    |
| `[[param]]`    | `lang.vue`   | `/`, `/en`, `/pt`      | `/en/us`       |
| `[...param]`   | `param.vue`  | `/a`, `/a/b`, `/a/b/c` | `/`            |
| `[[...param]]` | `param.vue`  | `/`, `/a`, `/a/b/c`    | N/A            |

#### Examples

1. **Required Parameter** (`[param]`):

```vue
<script setup>
   // Definindo a prop que vem do seu roteador (Vatts.js)
   const props = defineProps({
      params: {
         type: Object,
         default: () => ({})
      }
   });
   
   console.log('Server parameter:', props.params.server);
</script>
<script>
   export const config = {
      pattern: '/[server]',
      component: undefined,
      generateMetadata: () => ({
         title: 'Vatts.js | Home'
      })
   };
</script>
<template>
   <h1>Hello {{ props.params.server || 'World' }}</h1>
</template>
```

---

## File-based Routing with `pathRouter`

If you prefer a file-system-based routing convention, you can enable the `pathRouter` option in your `vatts.config.ts` or `vatts.config.js`:

```ts
// vatts.config.ts
export default {
  pathRouter: true,
};
```

When `pathRouter` is enabled, Vatts will automatically create routes based on the file structure in `/src/web/`.

-   A file at `/src/web/page.vue` will correspond to the `/` URL path.
-   A file at `/src/web/blog/[id]/page.vue` will correspond to the `/blog/:id` URL path.

---

## Backend Routes

Backend routes live in `/src/backend/routes`. Each file exports a `BackendRouteConfig`.

### Route Configuration

```ts
export interface BackendRouteConfig {
    pattern: string;
    GET?: BackendHandler;
    POST?: BackendHandler;
    PUT?: BackendHandler;
    DELETE?: BackendHandler;
    WS?: WebSocketHandler;
    middleware?: VattsMiddleware[];
}
```

### HTTP Examples

1. **Basic GET Route**:

```ts
// src/backend/routes/api/version.ts
import { BackendRouteConfig, VattsResponse } from "vatts";

const route: BackendRouteConfig = {
    pattern: "/api/version",
    GET: () => {
        return VattsResponse.json({
            version: "1.0.0",
            name: "Vatts.js Example"
        });
    }
};

export default route;
```

2. **CRUD Endpoints**:

```typescript
// src/backend/routes/api/users.ts
import { BackendRouteConfig, VattsResponse } from "vatts";

const users = new Map<string, { id: string; name: string }>();

const route: BackendRouteConfig = {
    pattern: "/api/users/[[id]]",

    // List users or get one user
    GET: async (_request, params) => {
        if (params.id) {
            const user = users.get(params.id);
            if (!user) return VattsResponse.notFound();
            return VattsResponse.json(user);
        }
        return VattsResponse.json([...users.values()]);
    },

    // Create user
    POST: async (request) => {
        const user = await request.json();
        const id = Date.now().toString();
        users.set(id, { id, ...user });
        return VattsResponse.json({ id }, { status: 201 });
    },

    // Update user
    PUT: async (request, params) => {
        if (!params.id) return VattsResponse.badRequest();
        const user = await request.json();
        users.set(params.id, { ...user, id: params.id });
        return VattsResponse.json({ success: true });
    },

    // Delete user
    DELETE: async (_request, params) => {
        if (!params.id) return VattsResponse.badRequest();
        users.delete(params.id);
        return VattsResponse.json({ success: true });
    }
};

export default route;
```

### WebSocket Examples

1. **Basic Chat**:

```ts
// src/backend/routes/ws/chat.ts
import { BackendRouteConfig, WebSocket } from "vatts";

const connections = new Set<WebSocket>();

const route: BackendRouteConfig = {
    pattern: "/ws/chat",
    WS: {
        onConnect: (ws) => {
            connections.add(ws);
            ws.send(JSON.stringify({ type: "welcome" }));
        },

        onMessage: (ws, message) => {
            const data = JSON.parse(message);

            // Broadcast to all connected clients
            connections.forEach((client) => {
                if (client !== ws) {
                    client.send(
                        JSON.stringify({
                            type: "message",
                            text: data.text
                        })
                    );
                }
            });
        },

        onClose: (ws) => {
            connections.delete(ws);
        }
    }
};

export default route;
```

---

## Best Practices

### Frontend Routes

1. **Organization**
   - Group related routes in folders
   - Keep components separated from routes

2. **Metadata**
   - Always provide metadata for SEO
   - Use dynamic metadata based on params

3. **Parameters**
   - Use descriptive parameter names
   - Validate parameters when needed

### Backend Routes

1. **API Design**
   - Follow RESTful conventions
   - Use appropriate HTTP methods
   - Return consistent response structures

2. **Security**
   - Always validate input
   - Handle errors gracefully

3. **WebSockets**
   - Clean up resources on disconnect
   - Implement heartbeat mechanisms
   - Handle reconnection scenarios
