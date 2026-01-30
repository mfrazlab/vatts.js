# Session Management

Learn how to access, manage, and use authentication sessions in your Vatts.js application—both on the frontend (React) and backend (API routes).

---

## Overview

Session management is at the core of authentication. It allows you to:

- Check if a user is logged in
- Access user information in your components and API routes
- Log users in and out securely

Vatts.js Auth provides simple hooks and helpers for both frontend and backend session handling.

---

## Frontend: Using Sessions in React

### Accessing Session Data

Use the `useSession` hook from `@vatts/auth/react` to access the current session and authentication status in your React components:

```typescript jsx
import React from "react";
import { useSession } from "@vatts/auth/react";

export default function Profile() {
  const { data: session, status, signOut } = useSession();

  if (status === "loading") return <div>Loading...</div>;
  if (!session) return <div>You are not logged in.</div>;

  return (
    <div>
      <p>Welcome, {session.user.name}!</p>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  );
}
```

- `session`: The current session object, or `null` if not logged in.
- `status`: One of `"loading"`, `"authenticated"`, or `"unauthenticated"`.
- `signOut`: Function to log the user out.

---

### Logging In with Credentials

To log in with username and password, use the `signIn` function from `useSession`. Here’s a full example of a login page:

```typescript jsx
import React, { useState } from "react";
import { useSession } from "@vatts/auth/react";
import { router } from "vatts/react"; // or your router

export default function LoginPage() {
  const { signIn } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const result = await signIn("credentials", {
        redirect: false,
        username,
        password,
        callbackUrl: "/"
      });
      if (!result || result.error) {
        setError("Invalid credentials. Please check your username and password.");
        setIsLoading(false);
        return;
      }
      router.push("/");
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={e => setUsername(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />
      <button type="submit" disabled={isLoading}>Sign In</button>
      {error && <div>{error}</div>}
    </form>
  );
}
```

---

### Logging In with OAuth Providers

To log in with an OAuth provider (like Google or Discord), call `signIn` with the provider name:

```typescript jsx
import { useSession } from "@vatts/auth/react";
const { signIn } = useSession();

const handleOAuthLogin = async () => {
  await signIn("google", { redirect: true });
};
```

Replace `"google"` with your configured provider ID.

---

### Signing Out

To log out, simply call the `signOut` function from `useSession`:

```typescript jsx
import { useSession } from "@vatts/auth/react";
const { signOut } = useSession();

<button onClick={() => signOut()}>Sign Out</button>
```

---

## Backend: Accessing the Session in API Routes

You can access the current session in your backend routes using the `getSession` method from your auth instance.

**Example: Protecting an API Route**

```typescript
import auth from "../auth"; // Import your src/backend/auth.ts
import { BackendRouteConfig, VattsResponse } from "vatts";

const route: BackendRouteConfig = {
  pattern: "/api/version",
  GET: async (request, params): Promise<VattsResponse> => {
    const session = await auth.auth.getSession(request);
    if (session != null) {
      console.log(`User ID: ${session.user.id}`);
    }
    return VattsResponse.json({
      success: true,
      version: "1.0.0",
      name: "Vatts.js Example"
    });
  }
};

export default route;
```

- `getSession(request)`: Returns the session object if the user is authenticated, or `null` otherwise.
- Use this to protect sensitive routes or personalize API responses.

---

## Best Practices

- Always check the session status before showing sensitive information.
- Use `signOut` to securely log users out and clear their session.
- For OAuth, make sure your provider is configured in your backend auth config.
- Never expose sensitive session data to the client.


