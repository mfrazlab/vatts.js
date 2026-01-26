# Layout in Vatts.js

The `layout.tsx` file is the root layout component for your Vatts.js application. It wraps all pages and provides global configuration, metadata, and styles. Think of it as the template that surrounds every page in your application.

---

## Basic Example

Here's a simple layout with essential features:

```tsx
import React from 'react';
import { Metadata } from "vatts/react";
import './globals.css';

interface LayoutProps {
    children: React.ReactNode;
}

export const metadata: Metadata = {
    title: "My App",
    description: "Welcome to my Vatts.js application",
    viewport: "width=device-width, initial-scale=1.0",
};

export default function Layout({children}: LayoutProps) {
    return (
        <html lang="en">
        <body>
        <nav>
            <a href="/">Home</a>
            <a href="/about">About</a>
        </nav>
        <main>
            {children}
        </main>
        <footer>
            © {new Date().getFullYear()} My App
        </footer>
        </body>
        </html>
    );
}
```

---

## The Metadata Type

The `Metadata` interface provides extensive options for configuring your app's meta tags:

```tsx
export interface Metadata {
    // Basic metadata
    title?: string;
    description?: string;
    keywords?: string | string[];
    author?: string;
    favicon?: string;
    
    // Viewport and mobile
    viewport?: string;
    themeColor?: string;
    
    // SEO
    canonical?: string;
    robots?: string;
    
    // Open Graph (Facebook, LinkedIn, etc.)
    openGraph?: {
        title?: string;
        description?: string;
        type?: string;
        url?: string;
        image?: string | {
            url: string;
            width?: number;
            height?: number;
            alt?: string;
        };
        siteName?: string;
        locale?: string;
    };
    
    // Twitter Card
    twitter?: {
        card?: 'summary' | 'summary_large_image' | 'app' | 'player';
        site?: string;
        creator?: string;
        title?: string;
        description?: string;
        image?: string;
        imageAlt?: string;
    };
    
    // Additional metadata
    language?: string;
    charset?: string;
    appleTouchIcon?: string;
    manifest?: string;
    
    // Custom meta tags
    other?: Record<string, string>;
    scripts?: Record<string, Record<string, string>>;
}
```

---

## Global CSS

You can import CSS files **anywhere in your project** — pages, components, layouts, or routes.

This gives you flexibility to:

* Scope styles closer to where they’re used
* Split styles by feature or component
* Improve maintainability in larger projects

If you still want truly global styles (reset, theme variables, base typography, etc.), you can optionally import a main stylesheet in `layout.tsx`:

```tsx
import './globals.css';
```

This is recommended for styles that should apply to the entire application, but it’s no longer required.

---

## Using Providers

You can wrap your layout with any number of providers:

```tsx
import { SessionProvider } from "@vatts/auth/react";
import { ThemeProvider } from './context/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export default function Layout({ children }: LayoutProps) {
    return (
        <html lang="en">
            <body>
                <SessionProvider>
                    <ThemeProvider>
                        <QueryClientProvider client={queryClient}>
                            {children}
                        </QueryClientProvider>
                    </ThemeProvider>
                </SessionProvider>
            </body>
        </html>
    );
}
```

Common providers include:
- Authentication providers
- Theme providers
- State management providers
- Data fetching providers
- Analytics providers

---

## Best Practices

1. **Keep It Simple**
   - The layout should focus on structure and global concerns
   - Move complex UI components to separate files
   - Use composition for nested layouts

2. **Performance**
   - Minimize the number of providers
   - Avoid heavy computations in the layout
   - Use lazy loading for non-critical components

3. **Metadata**
   - Include all essential meta tags for SEO
   - Provide fallbacks for social sharing
   - Keep metadata up to date

4. **Accessibility**
   - Include proper ARIA landmarks
   - Maintain good HTML structure
   - Consider skip links for navigation

5. **Maintenance**
   - Keep styles organized
   - Document special cases
   - Use TypeScript for better type safety

