# Project Structure

Understanding how Vatts.js organizes your files is essential for building clean, efficient, and scalable applications.

This guide explains the folder structure, special files, and conventions used throughout the framework.

---

## Overview

A typical Vatts.js project follows this structure:

```
my-project/
├── src/
│   ├── web/
│   │   ├── layout.tsx
│   │   ├── notFound.tsx
│   │   ├── globals.css
│   │   ├── routes/
│   │   │   ├── index.tsx
│   │   │   ├── about.tsx
│   │   │   └── blog/
│   │   │       └── [id].tsx
│   │   └── components/
│   │       └── Header.tsx
│   ├── backend/
│   │   └── routes/
│   │       ├── api.ts
│   │       └── users.ts
│   └── vattsweb.ts
├── public/
│   ├── favicon.ico
│   └── images/
├── vatts.config.ts
├── tsconfig.json
└── package.json
```

---

## Root Directories

### `/src`

The main source directory where all application logic lives, including frontend, backend, and startup logic. You can use `.ts`, `.tsx`, `.js`, or `.jsx` files for your code.

### `/public`

Static assets served directly by the server. Files inside this folder are accessible from the root URL.

Examples:

- `public/logo.png` → `http://localhost:3000/logo.png`
- `public/images/hero.jpg` → `http://localhost:3000/images/hero.jpg`

---

## Web Directory

The `/src/web` directory contains all frontend-related code.

### Frontend Routing Structure

Vatts supports two different routing strategies, which affects how you structure your files.

#### 1. `RouteConfig` (Default)

By default, routes are defined in `/src/web/routes`. In this system, you explicitly export a `RouteConfig` object from each file to define a route's pattern and component.

| File                         | Route           |
|------------------------------|-----------------|
| `routes/index.tsx`           | `/`             |
| `routes/about.tsx`           | `/about`        |
| `routes/blog/index.tsx`      | `/blog`         |
| `routes/blog/[id].tsx`       | `/blog/:id`     |
| `routes/user/profile.tsx`    | `/user/profile` |

To learn how to register routes (patterns, dynamic params, metadata, etc.), see the **Routing** guide: `/docs/vatts/routing`.

#### 2. `pathRouter` (File-based)

Alternatively, you can enable `pathRouter: true` in `vatts.config.ts`. This activates a file-system-based routing convention where the file structure inside `/src/web/` directly maps to URL routes.

- `/src/web/page.tsx` -> `/`
- `/src/web/about/page.tsx` -> `/about`
- `/src/web/blog/[id]/page.tsx` -> `/blog/:id`

This approach is more conventional if you prefer a file-system-driven routing experience.

---

### `/src/web/layout.tsx`

The root layout that wraps every page in your application.

This file is used to define:

- Global metadata such as title and description
- Shared UI elements like headers and footers
- Global providers, themes, and contexts
- Global styles

Key points:

- The layout component receives `children`
- You can export a `metadata` object for SEO
- This layout wraps all frontend pages

---

### `/src/web/notFound.tsx`

The custom 404 page rendered when a route does not exist.

Shown when:

- A user navigates to a URL that does not match any route
- Example: `/page-that-does-not-exist`

You can fully customize this page with your own UI and branding.

---

### `/src/web/globals.css`

Global styles applied to the entire application.

This file is imported in `layout.tsx` and typically includes resets, typography, color variables, and base styles.

---

## Backend Directory

The `/src/backend` directory contains all server-side logic.

### `/src/backend/routes`

This directory contains your backend route modules (API endpoints).

Vatts.js uses this folder as a **conventional place to organize backend routes**, including nested paths and grouped domains (e.g. `auth`, `users`, `admin`).
However, backend routing is driven by **explicit route definitions**, not by automatically mapping files to URLs.

Each route module defines one or more routes by exporting a **`BackendRouteConfig`**, where you describe:

* the route path (e.g. `/auth/login`)
* the supported HTTP or WS methods
* the handler logic
* optional metadata (middlewares, auth, validation, etc.)

The folder/file structure is only an organizational aid — the actual routing behavior comes from the exported configuration, which the backend router loads and registers at runtime.

To learn how backend routes are defined, configured, and registered (methods, params, WebSocket support, metadata, etc.), see the **Routing** guide: `/docs/vatts/routing`.

___

## Server-Only Imports

### `importServer()`

Vatts.js provides the `importServer()` utility to safely import server-only code.

Important rules:

- `importServer()` can only be used inside `/src/backend`
- It must never be used in `/src/web`
- Code imported with `importServer()` is guaranteed to never be bundled or executed on the client

This makes it ideal for:

- Database access
- Authentication logic
- Secrets and environment variables
- Heavy server-only dependencies

Using `importServer()` ensures a strict separation between frontend and backend and prevents accidental data leaks to the client.

---

## Instrumentation File

### `/src/vattsweb.ts`

This special file runs once when your Vatts.js application starts.

Common use cases:

- Initialize database connections
- Register global middleware
- Configure logging
- Set up background jobs
- Load environment-based configuration

Key details:

- Must export a default function
- Can be asynchronous
- Runs before any routes are loaded
- Executes in both development and production

This is the ideal place for one-time application setup logic.

---

## Configuration Files

### `vatts.config.ts`

The main configuration file for Vatts.js, located at the project root. You can also use `vatts.config.js`.

Used to:

- Configure server behavior
- Register plugins and middleware
- Control runtime and build settings
- Customize development and production behavior
- Enable `pathRouter` for file-based routing

Any server-level customization belongs here.

---

### `tsconfig.json`

TypeScript configuration file.

Required configuration:

```json
{
  "compilerOptions": {
    "types": ["vatts/global"]
  }
}
```

Including `vatts/global` is required for Vatts.js global types. This file is required when using JavaScript or TypeScript.

---

### `package.json`

Defines project dependencies and scripts.

Example scripts:

```json
{
  "scripts": {
    "dev": "vatts dev",
    "start": "vatts start"
  }
}
```

* dev starts the development server with hot reload
* start runs the application in production mode
