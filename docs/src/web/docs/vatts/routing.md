# Routing in Vatts.js

Vatts.js has a flexible routing system for both **frontend** and **backend**. This guide explains how routes work, how to create route files, and what patterns you can use.

---

## Routing Strategies

Vatts provides two routing strategies for the frontend:

1.  **RouteConfig (Default)**: This strategy is based on explicitly defining route configurations in files located in `/src/web/routes`. Each file exports a `RouteConfig` object that specifies the URL pattern and the component to render.
2.  **PathRouter (File-based)**: This is an alternative, file-system-based routing strategy. When `pathRouter: true` is set in your `vatts.config.ts` (or `.js`), Vatts will automatically create routes based on the file structure in `/src/web/`. For example, `/src/web/page.tsx` maps to the `/` route, and `/src/web/blog/[id]/page.tsx` maps to the `/blog/:id` route.

This guide primarily focuses on the `RouteConfig` strategy. For more details on `pathRouter`, see the file-based routing section below.

---

## Frontend Routes with `RouteConfig`

When using the default `RouteConfig` strategy, frontend routes live in `/src/web/routes`.

> Important: **creating a route file is not enough by itself**.
>
> Unlike fully file-based frameworks, in Vatts.js you typically **must register your routes** so they become active.

### Basic Route

The simplest route exports a `RouteConfig` with a `pattern` and a `component`. You can use `.tsx`, `.ts`, `.jsx`, or `.js` files.

```tsx
import { Metadata, RouteConfig } from "vatts/react";
import Home from "../components/Home";

export const config: RouteConfig = {
    pattern: "/",
    component: Home,
    generateMetadata: (): Metadata => ({
        title: "Vatts.js | Home"
    })
};

export default config;
```

### Dynamic Routes

Vatts.js supports several kinds of dynamic params in the `pattern`:

| Pattern        | Example File      | Matches                | Does Not Match |
|----------------|-------------------|------------------------|----------------|
| `[param]`      | `[id].tsx`        | `/1`, `/2`             | `/`, `/1/2`    |
| `[[param]]`    | `[[lang]].tsx`    | `/`, `/en`, `/pt`      | `/en/us`       |
| `[...param]`   | `[...slug].tsx`   | `/a`, `/a/b`, `/a/b/c` | `/`            |
| `[[...param]]` | `[[...slug]].tsx` | `/`, `/a`, `/a/b/c`    | N/A            |

#### Examples

1. **Required Parameter** (`[param]`):

```tsx
// src/web/routes/blog/[id].tsx
import { RouteConfig } from "vatts/react";

interface PostParams {
    id: string;
}

function BlogPost({ params }: { params: PostParams }) {
    return <h1>Blog Post {params.id}</h1>;
}

export const config: RouteConfig = {
    pattern: "/blog/[id]",
    component: BlogPost,
    generateMetadata: ({ id }) => ({
        title: `Blog Post ${id}`
    })
};

export default config;
```

2. **Optional Parameter** (`[[param]]`):

```tsx
// src/web/routes/[[lang]]/about.tsx
import { RouteConfig } from "vatts/react";

interface AboutParams {
    lang?: string;
}

function About({ params }: { params: AboutParams }) {
    const language = params.lang || "en";
    return <h1>About Page ({language})</h1>;
}

export const config: RouteConfig = {
    pattern: "/[[lang]]/about",
    component: About
};

export default config;
```

3. **Catch-all Routes** (`[...param]`):

```tsx
// src/web/routes/docs/[...slug].tsx
import { RouteConfig } from "vatts/react";

interface DocsParams {
    slug: string[];
}

function Documentation({ params }: { params: DocsParams }) {
    return <h1>Docs: {params.slug.join("/")}</h1>;
}

export const config: RouteConfig = {
    pattern: "/docs/[...slug]",
    component: Documentation
};

export default config;
```

4. **Optional Catch-all Routes** (`[[...param]]`):

```tsx
// src/web/routes/[[...path]].tsx
import { RouteConfig } from "vatts/react";

interface CatchAllParams {
    path?: string[];
}

function CatchAll({ params }: { params: CatchAllParams }) {
    if (!params.path) return <h1>Root Page</h1>;
    return <h1>Path: {params.path.join("/")}</h1>;
}

export const config: RouteConfig = {
    pattern: "/[[...path]]",
    component: CatchAll
};

export default config;
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

-   A file at `/src/web/page.tsx` will correspond to the `/` URL path.
-   A file at `/src/web/blog/[id]/page.tsx` will correspond to the `/blog/:id` URL path.

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
    PUT: async (request, params) => {.
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
   - Use `index.tsx` for main routes
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
