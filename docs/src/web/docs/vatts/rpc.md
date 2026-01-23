# RPC in Vatts.js

Vatts.js provides a **built-in, type-safe RPC system** that lets your frontend call backend functions **directly**, without manually creating APIs, routes, or HTTP clients.

This is one of Vatts.js’ **core differentiators**:
you write **normal backend functions**, expose them intentionally, and consume them on the frontend **as if they were local async functions** — fully typed and secure.

---

## How it works (conceptually)

* **Backend**

    * Write regular TypeScript functions.
    * Explicitly register them with `Expose()`.
    * Nothing is auto-exposed.

* **Frontend**

    * Import exposed server functions using `importServer()`.
    * Functions are **fully typed** and **always async**.
    * Calls are transported securely through Vatts’s internal RPC layer.

> ⚠️ **Important:**
> Calling `Expose()` does **NOT** mean your function becomes a public HTTP endpoint.
>
> Exposed functions are **only accessible through Vatts’s RPC runtime**, not via URLs, REST, or direct web access.

---

## Why this is powerful

- This system is powerful because it removes the need to create routes every time a new function is added. You simply define the function and call it securely from the frontend.

---

## Data model: what you can return (and what you can’t)

RPC calls cross the server ↔ client boundary, so inputs and return values must be **serializable**.

That means you should return **JSON-friendly data** (or “JSON-like” structures), for example:

- primitives (`string`, `number`, `boolean`, `null`)
- plain objects and arrays
- data-transfer objects (DTOs)

And you should **not** return things that are tied to the server runtime or that can’t be serialized, for example:

- database connections/clients (Prisma client, Mongo client, knex instance, etc.)
- class instances that rely on methods/prototypes
- functions, streams, sockets, request/response objects, etc.

> Tip: keep RPC functions focused on **returning data**, not returning infrastructure.
> If you need DB access, do it inside the server function and return the result data.

---

## Backend: exposing functions

Place your RPC functions inside a backend file
(example: `/src/backend/helper.ts`).

```ts
// src/backend/helper.ts
import os from "os";
import Expose from "vatts/rpc";
import type { VattsRequest } from "vatts";

type DiagnosticsInput = {
    message?: string;
};

type DiagnosticsResult = {
    hostname: string;
    platform: string;
    message?: string;
    ip?: string;
};

function getOSName() {
    switch (os.platform()) {
        case "win32":
            return "Windows";
        case "linux":
            return "Linux";
        case "darwin":
            return "macOS";
        default:
            return `Unknown (${os.platform()})`;
    }
}

// You can optionally receive the request as the **first** argument.
// - It's optional: you can omit it completely if you don't need request context.
// - If you include it, it must come first.
// - On the frontend, this parameter does NOT exist (the client never passes `_req`).
export async function getServerDiagnostics(
    _req: VattsRequest,
    input: DiagnosticsInput
): Promise<DiagnosticsResult> {
    return {
        hostname: os.hostname(),
        platform: getOSName(),
        message: input.message,
        ip: _req.ip
    };
}

export function getPackageVersion() {
    // Simple example — could also read from package.json
    return "1.0.0";
}

// Explicitly expose only what you want available to the frontend
Expose(getServerDiagnostics, getPackageVersion);
```

### Key points (backend)

* Functions are **normal TypeScript functions**
* `Expose()` is **explicit and intentional**
* No routes, controllers, or HTTP handlers
* `VattsRequest` is optional, and when used it must be the **first** parameter
* On the frontend, `_req` is never part of the call signature
* If it’s not passed to `Expose()`, it **cannot be called**

---

## Frontend: importing and calling server functions

On the frontend, use `importServer()` to load the exposed functions.

```tsx
import { importServer } from "vatts/react";

// Typed import: gives you full intellisense + compile-time safety
const api = importServer<typeof import("../../backend/helper")>(
    "../../backend/helper"
);

const { getServerDiagnostics, getPackageVersion } = api;

export default function Example() {
    async function run() {
        // All RPC calls are async on the client
        const version = await getPackageVersion();

        const diagnostics = await getServerDiagnostics({
            message: "Hello from the client"
        });

        console.log({ version, diagnostics });
    }

    return <button onClick={() => void run()}>Call server</button>;
}
```

### Key points (frontend)

* Imported functions behave like normal async functions
* With the typed `importServer<typeof import("...")>("...")` pattern, the frontend automatically inherits the backend function types (params + return)
* No fetch, no axios, no manual API contracts
* Serialization and transport are handled internally by Vatts

---

## Security model

Vatts’s RPC system is designed to be **secure by default**:

*  Functions are **not exposed via HTTP routes**
*  Only explicitly exposed functions are callable
*  Symbols and internal metadata prevent spoofing
*  Request context is controlled and server-only
*  Client cannot discover or call arbitrary server code

> In short:
> **Expose ≠ public API endpoint**

---

## Notes & best practices

* Treat all imported RPC functions as **always async**
* Keep RPC logic small and focused
* Use `_req?: VattsRequest` only when you need request data
* Never expose internal-only or unsafe functions
* Think of RPC as **“server functions, safely callable from the client”**
