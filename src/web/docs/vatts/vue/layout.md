
# Layout in Vatts.js - Vue

The `layout.vue` file is the root layout component for your Vatts.js application. It wraps all pages and provides global configuration, metadata, and styles. Think of it as the template that surrounds every page in your application.
  
---  

## Basic Example

Here's a simple layout with essential features:

```vue
<script lang="ts">
import type { Metadata } from "vatts/vue";

export const metadata: Metadata = {  
 title: "My App", description: "Welcome to my Vatts.js application", viewport: "width=device-width, initial-scale=1.0",};  
</script>

<script setup lang="ts">
import './globals.css';
</script>

<template>
    <slot />
</template>
```  
  
---  


## The Metadata Type

The `Metadata` interface provides extensive options for configuring your app's meta tags:

```ts  
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

If you still want truly global styles (reset, theme variables, base typography, etc.), you can optionally import a main stylesheet in `layout.vue`:

```vue
import './globals.css';
```

This is recommended for styles that should apply to the entire application, but it’s no longer required.

---

## Using Providers

You can wrap your layout with any number of providers:

```vue
<script lang="ts">  
import type { Metadata } from "vatts/vue";  
  
export const metadata: Metadata = {  
  title: "Vatts JS | The Fast and Simple Web Framework",  
  description: "The fastest and simplest web framework! Start building high-performance web applications today with Vatts JS.",  
  keywords: ["Vatts JS", "web framework", "React", "Vue", "JavaScript", "TypeScript", "web development", "fast", "simple", "SSR", "frontend"],  
  author: "Vatts JS Team",  
};  
</script>  
  
<script setup lang="ts">  
import './globals.css';  
import {SessionProvider} from "@vatts/auth/vue";  
</script>  
  
<template>  
 <SessionProvider> 
	 <slot /> 
 </SessionProvider>
</template>
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