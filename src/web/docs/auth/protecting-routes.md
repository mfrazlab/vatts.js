# Protecting Routes

Learn how to restrict access to certain pages and API endpoints in your Vatts.js application, ensuring only authenticated users (or only guests) can access them.

---

## Backend: Protecting API Routes

To protect backend routes, simply check the session status using `getSession` from your auth instance. If the session is `null`, the user is not authenticated and you can return an error or redirect as needed.

**Example: Protecting an API Route**

```typescript
import auth from "../auth";
import { BackendRouteConfig, VattsResponse } from "vatts";

const route: BackendRouteConfig = {
  pattern: "/api/protected",
  GET: async (req, params) => {
    const session = await auth.auth.getSession(req);
    if (!session) {
      return VattsResponse.json({ error: "Unauthorized" }, 401);
    }
    // User is authenticated
    return VattsResponse.json({ message: "Welcome, " + session.user.name });
  }
};

export default route;
```

- Always check the session before returning sensitive data.
- You can return a 401 Unauthorized or redirect to a login page as needed.

---

## Frontend: Protecting Pages and Components

Vatts.js Auth provides flexible ways to protect frontend routes and components using hooks and helpers.

### Types
- **GuestOnly**: Renders children only for unauthenticated users.
- **AuthGuard**: Renders children only for authenticated users.

```typescript
interface GuardProps {
    children: ReactNode;
    fallback?: ReactNode;
    redirectTo?: string;
}
```

### GuestOnly Component

To restrict a page to guests (users who are not logged in), use the `<GuestOnly>` component. This will render its children only if the user is not authenticated. If the user is authenticated, you can optionally redirect or show a fallback.

### Types
```typescript
export function GuestOnly({ children, fallback, redirectTo }: GuardProps)
```

#### Example:

```typescript jsx
import LoginPage from "../components/Login";
import { RouteConfig } from "vatts/react";
import { GuestOnly } from "@vatts/auth/react";
import React from "react";

const wrapper = () => {
  return (
    <GuestOnly redirectTo="/">
      <LoginPage />
    </GuestOnly>
  );
};

export const config: RouteConfig = {
  pattern: '/login',
  component: wrapper,
  generateMetadata: () => ({
    title: 'Vatts.js | Login'
  })
};

export default config;
```

**How it works:**
- While loading, shows a fallback (or nothing by default).
- If authenticated, redirects to the home page (or the path you specify in `redirectTo`).
- If unauthenticated, renders the login page.

This pattern ensures only guests can access the login page.

---

### AuthGuard Component

To protect any part of your UI (pages or components) so only authenticated users can see it, use the `<AuthGuard>` component:

### Types
```typescript
export function AuthGuard({ children, fallback, redirectTo }: GuardProps)
```

#### Example:

```typescript jsx
import { AuthGuard } from "@vatts/auth/react";

<AuthGuard fallback={<div>Please log in.</div>} redirectTo="/login">
  <ProtectedComponent />
</AuthGuard>
```

**Props:**
- `children`: The content to show if the user is authenticated.
- `fallback`: (Optional) What to show if the user is not authenticated (default: nothing).
- `redirectTo`: (Optional) Path to redirect unauthenticated users (default: none).

**Example:**

```typescript jsx
import { AuthGuard } from "@vatts/auth/react";

export default function DashboardPage() {
  return (
    <AuthGuard redirectTo="/login">
      <h1>Dashboard</h1>
      {/* Protected content here */}
    </AuthGuard>
  );
}
```

- If the user is not authenticated, they will be redirected to `/login`.
- If authenticated, the dashboard is shown.

---
