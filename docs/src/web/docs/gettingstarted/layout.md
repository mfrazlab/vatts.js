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

## Complete Example with All Features

Here's a comprehensive example showing all available options:

```tsx
import React from 'react';
import { Metadata } from "vatts/react";
import { SessionProvider } from "@vatts/auth/react";
import { ThemeProvider } from './context/theme';
import './globals.css';

interface LayoutProps {
    children: React.ReactNode;
}

export const metadata: Metadata = {
    // Basic metadata
    title: "Vatts.js | The Fast and Simple Web Framework for React",
    description: "The fastest and simplest web framework for React! Start building high-performance web applications today with Vatts.js.",
    keywords: ["Vatts.js", "web framework", "React", "JavaScript", "TypeScript"],
    author: "Vatts.js Team",
    
    // Browser configuration
    favicon: "/favicon.ico",
    viewport: "width=device-width, initial-scale=1.0",
    themeColor: "#0A0A0A",
    
    // SEO settings
    canonical: "https://vatts.com",
    robots: "index, follow",
    
    // Open Graph (Facebook, LinkedIn)
    openGraph: {
        title: "Vatts.js | The Fast and Simple Web Framework for React",
        description: "Discover Vatts.js — the web framework focused on performance and simplicity.",
        type: "website",
        url: "https://vatts.com",
        image: "https://vatts.com/og-image.png",
        siteName: "Vatts.js",
        locale: "en_US",
    },
    
    // Twitter Card
    twitter: {
        card: "summary_large_image",
        site: "@vatts",
        creator: "@your_creator",
        title: "Vatts.js | React Web Framework",
        description: "Build faster, lighter React websites with Vatts.js",
        image: "https://vatts.com/twitter-image.png",
        imageAlt: "Vatts.js Framework Logo",
    },
    
    // Mobile and PWA
    appleTouchIcon: "/apple-touch-icon.png",
    manifest: "/manifest.json",
    
    // Language and encoding
    language: "en-US",
    charset: "UTF-8",
    
    // Custom meta tags
    other: {
        "X-UA-Compatible": "IE=edge",
        "mobile-web-app-capable": "yes",
        "apple-mobile-web-app-capable": "yes",
    }
};

export default function Layout({ children }: LayoutProps) {
    return (
        <html lang="en">
            <body>
                <SessionProvider>
                    <ThemeProvider>
                        {/* Header with Navigation */}
                        <header className="main-header">
                            <nav>
                                <a href="/">Home</a>
                                <a href="/docs">Documentation</a>
                                <a href="/examples">Examples</a>
                                <a href="/blog">Blog</a>
                            </nav>
                        </header>

                        {/* Main Content Area */}
                        <main className="content">
                            {children}
                        </main>

                        {/* Footer */}
                        <footer className="main-footer">
                            <div className="footer-content">
                                <div className="footer-section">
                                    <h3>Documentation</h3>
                                    <a href="/docs/getting-started">Getting Started</a>
                                    <a href="/docs/api">API Reference</a>
                                </div>
                                <div className="footer-section">
                                    <h3>Community</h3>
                                    <a href="/discord">Discord</a>
                                    <a href="/github">GitHub</a>
                                </div>
                                <div className="footer-section">
                                    <h3>More</h3>
                                    <a href="/blog">Blog</a>
                                    <a href="/showcase">Showcase</a>
                                </div>
                            </div>
                            <div className="footer-bottom">
                                © {new Date().getFullYear()} Vatts.js. All rights reserved.
                            </div>
                        </footer>
                    </ThemeProvider>
                </SessionProvider>
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

The `layout.tsx` file is the **only place** where you should import your main CSS file:

```tsx
import './globals.css';
```

This ensures that your global styles are:
- Applied consistently across all pages
- Loaded once at the root level
- Properly optimized by Vatts.js

Do not import global CSS files in individual page components or routes.

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

