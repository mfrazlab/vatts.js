# Vatts.js Configuration File (`vatts.config.ts`)

This document explains every option available in your `vatts.config.ts` file. Use this as a reference to understand what each property does and how to configure your Vatts.js server.

---

## Type Definition

```ts
export interface VattsConfig {
    /**
     * The port your server will listen on.
     * @example 3000
     */
    port: number;

    /**
     * SSL configuration for HTTPS/HTTP3 support.
     */
    ssl?: {
        /**
         * Optional port for HTTP/3 (QUIC) protocol.
         */
        http3Port?: number;
        /**
         * Port to redirect HTTP traffic to HTTPS.
         */
        redirectPort: number;
        /**
         * Path to your SSL private key file.
         */
        key: string;
        /**
         * Path to your SSL certificate file.
         */
        cert: string;
        /**
         * (Optional) Path to your CA bundle file.
         */
        ca?: string;
    };

    /**
     * Enable or disable path-based routing. If true, uses file/folder structure for routing.
     */
    pathRouter?: boolean;

    /**
     * Maximum number of headers allowed per request.
     */
    maxHeadersCount?: number;
    /**
     * How long (ms) to wait for headers before timing out.
     */
    headersTimeout?: number;
    /**
     * How long (ms) to wait for the entire request before timing out.
     */
    requestTimeout?: number;
    /**
     * How long (ms) to keep the server open for keep-alive connections.
     */
    serverTimeout?: number;
    /**
     * Timeout (ms) for each individual request.
     */
    individualRequestTimeout?: number;
    /**
     * Maximum allowed URL length (in characters).
     */
    maxUrlLength?: number;

    /**
     * Enable or disable access logging (request logs).
     */
    accessLogging?: boolean;

    /**
     * CORS (Cross-Origin Resource Sharing) configuration.
     */
    cors?: {
        /**
         * Allowed origins. Can be a string, array, or function.
         */
        origin?: string | string[] | ((origin: string) => boolean);
        /**
         * Allowed HTTP methods (e.g. ["GET", "POST"]).
         */
        methods?: string[];
        /**
         * Allowed request headers.
         */
        allowedHeaders?: string[];
        /**
         * Headers exposed to the browser.
         */
        exposedHeaders?: string[];
        /**
         * Allow credentials (cookies, authorization headers).
         */
        credentials?: boolean;
        /**
         * How long (seconds) browsers can cache the CORS response.
         */
        maxAge?: number;
        /**
         * Enable or disable CORS.
         */
        enabled?: boolean;
    };

    /**
     * Security-related HTTP headers.
     */
    security?: {
        /**
         * Content Security Policy header value.
         */
        contentSecurityPolicy?: string;
        /**
         * Permissions Policy header value.
         */
        permissionsPolicy?: string;
        /**
         * Strict-Transport-Security header value.
         */
        strictTransportSecurity?: string;
    };

    /**
     * Custom headers to add to every response.
     */
    customHeaders?: Record<string, string>;

    /**
     * List of .env files to load (in order).
     */
    envFiles?: string[];
}
```

---


## Property Explanations

Below you’ll find a detailed explanation of every property and sub-property in the Vatts.js config file.

### `port`
**Type:** `number`  
The main port your Vatts.js server will listen on for HTTP/HTTPS traffic.  
**Example:** `3000` (so your app runs at `http://localhost:3000`)

---

### `ssl`
**Type:** `object` *(optional)*  
Configures HTTPS and HTTP/3 (QUIC) support for secure connections.

**Sub-properties:**
- **`http3Port`** (`number`, optional):
    - The port for HTTP/3 (QUIC) protocol. Use this if you want to enable HTTP/3 in addition to regular HTTPS.  
    - *Example:* `4433` (so HTTP/3 runs on `https://localhost:4433`)
- **`redirectPort`** (`number`):
    - The HTTP port that will automatically redirect all traffic to HTTPS.  
    - *Example:* `80` (so `http://` requests are redirected to `https://`)
- **`key`** (`string`):
    - Path to your SSL private key file (usually `.key`). Required for HTTPS.
- **`cert`** (`string`):
    - Path to your SSL certificate file (usually `.crt` or `.pem`). Required for HTTPS.
- **`ca`** (`string`, optional):
    - Path to your Certificate Authority bundle file, if your certificate is signed by an external CA. Not needed for self-signed certs.

---

### `pathRouter`
**Type:** `boolean` *(optional)*  
If `true`, enables file-system-based routing (pages and endpoints are mapped to files/folders). If `false`, disables this feature.  

---

### Advanced Server Options

- **`maxHeadersCount`** (`number`, optional):
    - Maximum number of HTTP headers allowed per request. Helps prevent certain attacks and resource exhaustion.
- **`headersTimeout`** (`number`, optional):
    - How long (in milliseconds) the server will wait to receive all headers before timing out the connection.
- **`requestTimeout`** (`number`, optional):
    - How long (in milliseconds) the server will wait for the entire request (headers + body) before timing out.
- **`serverTimeout`** (`number`, optional):
    - How long (in milliseconds) to keep server connections alive (for keep-alive/reuse).
- **`individualRequestTimeout`** (`number`, optional):
    - Timeout (in milliseconds) for each individual request. Useful for limiting slow requests.
- **`maxUrlLength`** (`number`, optional):
    - Maximum allowed length of the URL (in characters). Prevents abuse with extremely long URLs.

---

### `accessLogging`
**Type:** `boolean` *(optional)*  
If `true`, enables logging of all incoming HTTP requests. Useful for debugging, analytics, or auditing.

---

### `cors`
**Type:** `object` *(optional)*  
Configures Cross-Origin Resource Sharing (CORS), which controls which domains can access your server’s resources (important for APIs and SPAs).

**Sub-properties:**
- **`origin`** (`string | string[] | function`, optional):
    - Specifies which origins are allowed. Can be a single string, an array of strings, or a function that returns `true`/`false` for a given origin.
    - *Example:* `'https://mydomain.com'` or `["https://a.com", "https://b.com"]`
- **`methods`** (`string[]`, optional):
    - List of allowed HTTP methods (e.g., `["GET", "POST"]`).
- **`allowedHeaders`** (`string[]`, optional):
    - List of allowed request headers from the client.
- **`exposedHeaders`** (`string[]`, optional):
    - List of headers that browsers are allowed to access from the response.
- **`credentials`** (`boolean`, optional):
    - If `true`, allows cookies and credentials to be sent in cross-origin requests.
- **`maxAge`** (`number`, optional):
    - How long (in seconds) browsers can cache the CORS response.
- **`enabled`** (`boolean`, optional):
    - If `true`, enables CORS for your server. If `false`, disables it.

---

### `security`
**Type:** `object` *(optional)*  
Configures HTTP security headers to help protect your app from common web vulnerabilities.

**Sub-properties:**
- **`contentSecurityPolicy`** (`string`, optional):
    - Sets the Content-Security-Policy header, which controls what resources (scripts, styles, images, etc.) can be loaded by browsers. Helps prevent XSS attacks.
- **`permissionsPolicy`** (`string`, optional):
    - Sets the Permissions-Policy header, which controls access to browser features (like camera, geolocation, etc.).
- **`strictTransportSecurity`** (`string`, optional):
    - Sets the Strict-Transport-Security (HSTS) header, which tells browsers to always use HTTPS for your domain.

---

### `customHeaders`
**Type:** `Record<string, string>` *(optional)*  
Add any custom HTTP headers to every response.  
**Example:** `{ "X-Powered-By": "Vatts.js" }`

---

### `envFiles`
**Type:** `string[]` *(optional)*  
Specify a list of environment files to load (in order). Useful for managing secrets and environment variables.  
**Example:** `[".env", ".env.local"]`

---

## Usage Example

Copy the interface above into your `vatts.config.ts` file and export your configuration. You can use a function for dynamic config based on environment/phase:

```ts
import type { VattsConfigFunction } from 'vatts';

const vattsConfig: VattsConfigFunction = (phase, { defaultConfig }) => {
    return {
        ...defaultConfig,
        port: 3000,
        pathRouter: true,
        // Add more options as needed
    };
};

export default vattsConfig;
```

