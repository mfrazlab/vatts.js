# Authentication Providers

This section gives you an overview of the available authentication methods in Vatts.js.

---

## Overview

Vatts.js provides three built-in authentication providers to help you secure your applications:

* **Credentials Provider** for username/password authentication
* **Google Provider** for Google OAuth authentication
* **Discord Provider** for Discord OAuth authentication

Each provider is designed to be simple to set up while giving you the flexibility you need.

---

## Available Providers

### Credentials Provider

The standard username/password authentication

#### Types
```typescript
export interface CredentialsConfig {
    id?: string;
    name?: string;
    credentials: Record<string, {
        label: string;
        type: string;
        placeholder?: string;
    }>;
    authorize: (credentials: Record<string, string>) => Promise<User | null> | User | null;
}
```

#### Example Usage

```typescript
import { CredentialsProvider } from '@vatts/auth';

new CredentialsProvider({
    authorize(credentials: Record<string, string>): Promise<User | null> | User | null {
        // Your authentication logic here
        if (credentials.username === 'user' && credentials.password === 'pass') {
            return {
                id: '1',
                name: 'John Smith',
                email: 'john@example.com'
            };
        }
        return null;
    },
    credentials: {
        username: { label: "Username", type: "text", placeholder: "username" },
        password: { label: "Password", type: "password" }
    }
})
```

### OAuth Google Provider

Authenticate users with their Google accounts

#### Types
```typescript
export interface GoogleConfig {
    id?: string;
    name?: string;
    clientId: string;
    clientSecret: string;
    callbackUrl?: string;
    successUrl?: string;
    scope?: string[];
}
```

#### Example Usage
```typescript
import { GoogleProvider } from '@vatts/auth';

new GoogleProvider({
    clientId: "your-client-id",
    clientSecret: "your-client-secret",
    successUrl: "/dashboard",
    scope: ['openid', 'email', 'profile']
})
```

### OAuth Discord Provider

Authenticate users with their Discord accounts:

#### Types
```typescript
export interface DiscordConfig {
    id?: string;
    name?: string;
    clientId: string;
    clientSecret: string;
    callbackUrl?: string;
    successUrl?: string;
    scope?: string[];
}
```

#### Example Usage

```typescript
import { DiscordProvider } from '@vatts/auth';

new DiscordProvider({
    clientId: "your-client-id",
    clientSecret: "your-client-secret",
    callbackUrl: "http://localhost:3000/api/auth/discord/callback",
    successUrl: "/dashboard",
    scope: ['identify', 'email']
})
```
