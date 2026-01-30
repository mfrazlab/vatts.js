# Custom Auth Providers

You can create your own authentication providers in Vatts.js to integrate any login system, such as OAuth, SSO, LDAP, or custom credentials-based authentication.

## How it works

A custom provider must implement the `AuthProviderClass` interface, which you can import from:

```typescript
import { AuthProviderClass } from "@vatts/auth";
```

The main interface is:

```typescript
export interface AuthProviderClass {
  id: string;
  name: string;
  type: string;
  handleSignIn(credentials: Record<string, string>): Promise<User | string | null>;
  handleSignOut?(): Promise<void>;
  handleOauth?(credentials: Record<string, string>): Promise<string> | string;
  additionalRoutes?: AuthRoute[];
  getConfig?(): any;
}
```

- **id**: Unique identifier for the provider (e.g., "google", "discord", "my-provider").
- **name**: Human-friendly name for the provider.
- **type**: Provider type (e.g., "oauth", "credentials").
- **handleSignIn**: Main function for authentication. Should return a user object, a string (for errors/redirects), or null.
- **handleSignOut**: (optional) Logic for logging out.
- **handleOauth**: (optional) For OAuth providers, returns the redirect URL for the OAuth flow.
- **additionalRoutes**: (optional) Extra routes exposed by the provider.
- **getConfig**: (optional) Returns the provider's configuration.

---

## Example: Credentials Provider

```typescript
import { AuthProviderClass } from "@vatts/auth";

export class MyCredentialsProvider implements AuthProviderClass {
  id = "my-credentials";
  name = "Custom Login";
  type = "credentials";

  async handleSignIn(credentials) {
    // Validate credentials (e.g., email/password)
    if (credentials.email === "admin@site.com" && credentials.password === "1234") {
      return { id: "1", name: "Admin", email: "admin@site.com" };
    }
    return null;
  }
}
```

---

## Creating an OAuth Provider

OAuth providers require a specific flow to work correctly. Let's build a complete OAuth provider step by step, using Discord and Google as real examples.

### Understanding the OAuth Flow

1. **User initiates login** → Your app redirects to the OAuth provider (e.g., Discord, Google)
2. **User authorizes** → Provider redirects back to your callback URL with an authorization `code`
3. **Exchange code for token** → Your backend exchanges the code for an access token
4. **Fetch user data** → Use the access token to get user information
5. **Create session** → Return the user object to create a session

---

## Complete Example: Discord OAuth Provider

Here's a full implementation of a Discord OAuth provider:

```typescript
import type { AuthProviderClass, AuthRoute, User } from "@vatts/auth";
import { VattsRequest, VattsResponse } from "vatts";

export interface DiscordConfig {
  id?: string;
  name?: string;
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  successUrl?: string;
  scope?: string[];
}

export class DiscordProvider implements AuthProviderClass {
  public readonly id: string;
  public readonly name: string;
  public readonly type: string = "oauth";

  private config: DiscordConfig;
  private readonly defaultScope = ["identify", "email"];

  constructor(config: DiscordConfig) {
    this.config = config;
    this.id = config.id || "discord";
    this.name = config.name || "Discord";
  }

  /**
   * Step 1: Generate OAuth authorization URL
   */
  handleOauth(): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.callbackUrl,
      response_type: "code",
      scope: (this.config.scope || this.defaultScope).join(" ")
    });

    return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Step 2: Handle sign-in (either redirect to OAuth or process callback)
   */
  async handleSignIn(credentials: Record<string, string>): Promise<User | string | null> {
    // If we have a code, process the OAuth callback
    if (credentials.code) {
      return await this.processOAuthCallback(credentials);
    }

    // Otherwise, return the OAuth URL for redirect
    return this.handleOauth();
  }

  /**
   * Step 3: Exchange authorization code for access token and fetch user data
   */
  private async processOAuthCallback(credentials: Record<string, string>): Promise<User | null> {
    try {
      const { code } = credentials;

      // Exchange code for access token
      const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: this.config.callbackUrl,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error("Failed to exchange code for token");
      }

      const tokens = await tokenResponse.json();

      // Fetch user data using access token
      const userResponse = await fetch("https://discord.com/api/users/@me", {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });

      if (!userResponse.ok) {
        throw new Error("Failed to fetch user data");
      }

      const discordUser = await userResponse.json();

      // Return standardized user object
      return {
        id: discordUser.id,
        name: discordUser.global_name || discordUser.username,
        email: discordUser.email,
        image: discordUser.avatar
          ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
          : null,
        provider: this.id,
        providerId: discordUser.id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      };
    } catch (error) {
      console.error(`[${this.id}] OAuth callback error:`, error);
      return null;
    }
  }

  /**
   * Step 4: Define callback route
   */
  public additionalRoutes: AuthRoute[] = [
    {
      method: "GET",
      path: "/api/auth/callback/discord",
      handler: async (req: VattsRequest) => {
        const url = new URL(req.url || "", "http://localhost");
        const code = url.searchParams.get("code");

        if (!code) {
          return VattsResponse.json(
            { error: "Authorization code not provided" },
            { status: 400 }
          );
        }

        // Forward code to main signin endpoint
        const authResponse = await fetch(
          `${req.headers.origin || "http://localhost:3000"}/api/auth/signin`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider: this.id, code }),
          }
        );

        if (authResponse.ok) {
          const setCookieHeader = authResponse.headers.get("set-cookie");
          
          if (this.config.successUrl) {
            return VattsResponse
              .redirect(this.config.successUrl)
              .header("Set-Cookie", setCookieHeader || "");
          }
          
          return VattsResponse.json({ success: true })
            .header("Set-Cookie", setCookieHeader || "");
        }

        return VattsResponse.json(
          { error: "Session creation failed" },
          { status: 500 }
        );
      },
    },
  ];

  getConfig() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      clientId: this.config.clientId,
      callbackUrl: this.config.callbackUrl,
    };
  }
}
```

---

## Complete Example: Google OAuth Provider

Here's a full implementation of a Google OAuth provider:

```typescript
import type { AuthProviderClass, AuthRoute, User } from "@vatts/auth";
import { VattsRequest, VattsResponse } from "vatts";

export interface GoogleConfig {
  id?: string;
  name?: string;
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  successUrl?: string;
  scope?: string[];
}

export class GoogleProvider implements AuthProviderClass {
  public readonly id: string;
  public readonly name: string;
  public readonly type: string = "oauth";

  private config: GoogleConfig;
  private readonly defaultScope = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ];

  constructor(config: GoogleConfig) {
    this.config = config;
    this.id = config.id || "google";
    this.name = config.name || "Google";
  }

  /**
   * Step 1: Generate OAuth authorization URL
   */
  handleOauth(): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.callbackUrl,
      response_type: "code",
      scope: (this.config.scope || this.defaultScope).join(" "),
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Step 2: Handle sign-in (either redirect to OAuth or process callback)
   */
  async handleSignIn(credentials: Record<string, string>): Promise<User | string | null> {
    if (credentials.code) {
      return await this.processOAuthCallback(credentials);
    }
    return this.handleOauth();
  }

  /**
   * Step 3: Exchange authorization code for access token and fetch user data
   */
  private async processOAuthCallback(credentials: Record<string, string>): Promise<User | null> {
    try {
      const { code } = credentials;

      // Exchange code for access token
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: this.config.callbackUrl,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error("Failed to exchange code for token");
      }

      const tokens = await tokenResponse.json();

      // Fetch user data
      const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });

      if (!userResponse.ok) {
        throw new Error("Failed to fetch user data");
      }

      const googleUser = await userResponse.json();

      // Return standardized user object
      return {
        id: googleUser.id,
        name: googleUser.name,
        email: googleUser.email,
        image: googleUser.picture || null,
        provider: this.id,
        providerId: googleUser.id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      };
    } catch (error) {
      console.error(`[${this.id}] OAuth callback error:`, error);
      return null;
    }
  }

  /**
   * Step 4: Define callback route
   */
  public additionalRoutes: AuthRoute[] = [
    {
      method: "GET",
      path: "/api/auth/callback/google",
      handler: async (req: VattsRequest) => {
        const url = new URL(req.url || "", "http://localhost");
        const code = url.searchParams.get("code");

        if (!code) {
          return VattsResponse.json(
            { error: "Authorization code not provided" },
            { status: 400 }
          );
        }

        const authResponse = await fetch(
          `${req.headers.origin || "http://localhost:3000"}/api/auth/signin`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider: this.id, code }),
          }
        );

        if (authResponse.ok) {
          const setCookieHeader = authResponse.headers.get("set-cookie");
          
          if (this.config.successUrl) {
            return VattsResponse
              .redirect(this.config.successUrl)
              .header("Set-Cookie", setCookieHeader || "");
          }
          
          return VattsResponse.json({ success: true })
            .header("Set-Cookie", setCookieHeader || "");
        }

        return VattsResponse.json(
          { error: "Session creation failed" },
          { status: 500 }
        );
      },
    },
  ];

  getConfig() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      clientId: this.config.clientId,
      callbackUrl: this.config.callbackUrl,
    };
  }
}
```

---

## Key Points for OAuth Providers

### Required Methods

1. **`handleOauth()`**: Returns the OAuth provider's authorization URL
2. **`handleSignIn(credentials)`**:
    - If `credentials.code` exists → process the callback
    - Otherwise → return OAuth URL for redirect
3. **`additionalRoutes`**: Define callback route(s) to handle OAuth redirects

### Important Implementation Details

- **Never use the code twice**: Exchange it only once for a token
- **Set proper redirect URIs**: Must match exactly what you configure in the OAuth app
- **Handle errors gracefully**: OAuth can fail for many reasons
- **Store tokens securely**: Include `accessToken` and `refreshToken` in the user object if needed
- **Standardize user object**: Always return the same structure regardless of provider

---

## Registering your provider

Just add your custom class to the providers array in your configuration:

```typescript
import { MyCredentialsProvider } from "./my-provider";
import { DiscordProvider } from "./discord-provider";
import { GoogleProvider } from "./google-provider";

export default {
  providers: [
    new MyCredentialsProvider(),
    new DiscordProvider(),
    new GoogleProvider(),
    // ...other providers
  ]
};
```

---

## Tips
- Use `handleSignIn` to validate and return the authenticated user object.
- For OAuth, implement `handleOauth` to generate the login URL, and exchange the code for a token in `handleSignIn`.
- You can add extra routes using `additionalRoutes`.
- Check the official providers (Credentials, Discord, Google) as reference.