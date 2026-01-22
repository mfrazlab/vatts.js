# Installation

Add authentication to your Vatts.js application.

---

## Quick Start

### 1. Install the Package

```bash
npm install @vatts/auth
```

### 2. Configure Authentication

Create `src/backend/auth.ts`:

```typescript
import { CredentialsProvider, createAuthRoutes, User, AuthConfig } from '@vatts/auth';

export const authConfig: AuthConfig = {
    providers: [
        new CredentialsProvider({
            authorize(credentials: Record<string, string>): Promise<User | null> | User | null {
                // Add your authorization logic here
                return null;
            },
            credentials: {
                username: { label: "Username", type: "text", placeholder: "username" },
                password: { label: "Password", type: "password" }
            }
        })
    ],
    
    session: {
        strategy: 'jwt',
        maxAge: 24 * 60 * 60, // 24 hours
    },
    
    pages: {
        signIn: '/login',
        signOut: '/'
    },
    
    callbacks: {
        async session({session, provider}) {
            return session;
        }
    },
    
    secret: 'your-secret-key'
};

export const authRoutes = createAuthRoutes(authConfig);
```

### 3. Export Auth Routes to Backend

Create `src/backend/routes/auth.ts`:

```typescript
import { authRoutes } from '../auth';
export default authRoutes;
```

### 4. Add SessionProvider to Layout

Update your `src/web/layout.tsx`:

```typescript
import { SessionProvider } from "@vatts/auth/react";

export default function Layout({ children }: LayoutProps) {
    return (
        <SessionProvider>
            {children}
        </SessionProvider>
    );
}
```

That's it! Your app now has authentication support configured.
