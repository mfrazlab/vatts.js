# Configuration file type for `vatts.config.ts`

This document shows the TypeScript interface for `vatts.config.ts`. It provides the shape you can copy/paste into your configuration file.

---

## Type definition

```ts
export interface VattsConfig {
    port: number;
    ssl?: {
        redirectPort: number;
        key: string;
        cert: string;
        ca?: string;
    };
    pathRouter?: boolean;
    maxHeadersCount?: number;
    headersTimeout?: number;
    requestTimeout?: number;
    serverTimeout?: number;
    individualRequestTimeout?: number;
    maxUrlLength?: number;
    accessLogging?: boolean;
    cors?: {
        origin?: string | string[] | ((origin: string) => boolean);
        methods?: string[];
        allowedHeaders?: string[];
        exposedHeaders?: string[];
        credentials?: boolean;
        maxAge?: number;
        enabled?: boolean;
    };
    security?: {
        contentSecurityPolicy?: string;
        permissionsPolicy?: string;
        strictTransportSecurity?: string;
    };
    customHeaders?: Record<string, string>;
    envFiles?: string[];
}
```

---

## Usage

Copy the interface above into a `./vatts.config.ts` file and export it. Then use it to type your configuration object.

```ts
import type { VattsConfigFunction } from 'vatts';

const vattsConfig: VattsConfigFunction = (phase, { defaultConfig }) => {
    return {
        ...defaultConfig,
        port: 3000,
        pathRouter: true
    };
};

export default vattsConfig;
```

---

## Notes

This file shows the minimal type definition without inline comments. If you need a version with documentation comments or examples for each field, add a note and I'll include a detailed variant.
