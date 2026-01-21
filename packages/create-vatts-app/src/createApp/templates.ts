export function globalsCssTemplate(willTailwind: boolean) {
  // even without tailwind, leave empty file to avoid import errors
  return willTailwind ? `@import "tailwindcss";\n` : `body {
background-color: #030712; 
}`;
}

export function layoutTsxTemplate() {
  // keeping same content/behavior as original generator
  return `import React from 'react';
import {Metadata} from "vatts/react"
import './globals.css';

interface LayoutProps {
    children: React.ReactNode;
}

export const metadata: Metadata = {
    title: "Vatts JS | The Fast and Simple Web Framework for React",
    description: "The fastest and simplest web framework for React! Start building high-performance web applications today with Vatts JS.",
    keywords: ["Vatts JS", "web framework", "React", "JavaScript", "TypeScript", "web development", "fast", "simple", "SSR", "frontend"],
    author: "Vatts JS Team",
};

export default function Layout({ children }: LayoutProps) {
    return (
        <>{children}</>
    );
}
`;
}

export function vattsConfigTemplate() {
  return `import type { VattsConfigFunction } from 'vatts';

const hightConfig: VattsConfigFunction = (phase, { defaultConfig }) => {
    return defaultConfig;
};

export default hightConfig;`;
}

export function tsconfigTemplate(opts?: { moduleAlias?: string | false }) {
  const aliasPrefix = opts?.moduleAlias;
  const willAlias = typeof aliasPrefix === "string" && aliasPrefix.length > 0;

  // convert "@/" => "@/*" and strip trailing "/" for prefix like "@"
  const normalizedPrefix = willAlias ? (aliasPrefix.endsWith("/") ? aliasPrefix : `${aliasPrefix}/`) : "@/";
  const aliasKey = `${normalizedPrefix}*`; // "@/*"

  const aliasBlock = willAlias
    ? `,
    "baseUrl": ".",
    "paths": {
      "${aliasKey}": ["src/*"]
    }`
    : "";

  return `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "NodeNext",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "rootDir": "./src",
    "outDir": "./dist",
    "moduleResolution": "nodenext",
    "types": ["vatts/global"]${aliasBlock}
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
`;
}

export function postcssConfigTemplate() {
  return `const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    autoprefixer: {},
  },
};

module.exports = config;
`;
}

export function tailwindConfigTemplate() {
  return `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/web/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`;
}

export function webIndexRouteTemplate(willTailwind: boolean) {
  let base = `import React from 'react'; 
import {RouteConfig} from "vatts/react";`;

  if (willTailwind) {
    base += `
function Welcome() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 p-4 text-center">
      <div className="group relative">
        <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-400 opacity-25 blur transition duration-500 group-hover:opacity-50"></div>
        <div className="relative rounded-lg bg-gray-900 px-8 py-6 ring-1 ring-gray-800">
          <h1 className="mb-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Hello <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">World</span>
          </h1>
          
          <p className="text-sm font-medium text-gray-400">
            Running with <span className="text-gray-200">Vatts.js</span>
          </p>
        </div>
      </div>
    </div>
  );
}
`;
  } else {
    base += `
function Welcome() {
  const [isHovered, setIsHovered] = React.useState(false);

  // Definição dos estilos
  const styles: { [key: string]: React.CSSProperties } = {
    container: {
      display: 'flex',
      minHeight: '100vh',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#030712', // gray-950
      padding: '1rem',
      textAlign: 'center',
      fontFamily: 'sans-serif', // Padrão para garantir consistência
    },
    groupWrapper: {
      position: 'relative',
    },
    gradientBlur: {
      position: 'absolute',
      top: '-4px', // -inset-1 (aprox 0.25rem)
      right: '-4px',
      bottom: '-4px',
      left: '-4px',
      borderRadius: '0.5rem',
      background: 'linear-gradient(to right, #9333ea, #22d3ee)', // purple-600 to cyan-400
      filter: 'blur(8px)', // blur (padrao do tailwind é 8px ou 4px dependendo da versão, 8px fica bom aqui)
      transition: 'opacity 500ms ease',
      opacity: isHovered ? 0.5 : 0.25, // Controle via useState
    },
    card: {
      position: 'relative',
      borderRadius: '0.5rem',
      backgroundColor: '#111827', // gray-900
      padding: '1.5rem 2rem', // px-8 py-6
      border: '1px solid #1f2937', // simulando ring-1 ring-gray-800
      color: 'white',
    },
    title: {
      marginBottom: '0.5rem',
      fontSize: '2.25rem', // text-4xl
      fontWeight: 'bold',
      letterSpacing: '-0.025em', // tracking-tight
      color: 'white',
      lineHeight: 1,
    },
    gradientText: {
      color: 'transparent',
      backgroundClip: 'text',
      WebkitBackgroundClip: 'text',
      backgroundImage: 'linear-gradient(to right, #c084fc, #22d3ee)', // purple-400 to cyan-400
    },
    subtitle: {
      fontSize: '0.875rem', // text-sm
      fontWeight: 500,
      color: '#9ca3af', // gray-400
      margin: 0,
    },
    subtitleHighlight: {
      color: '#e5e7eb', // gray-200
    },
  };

  return (
      <div style={styles.container}>
        <div
            style={styles.groupWrapper}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
          <div style={styles.gradientBlur}></div>

          <div style={styles.card}>
            <h1 style={styles.title}>
              Hello <span style={styles.gradientText}>World</span>
            </h1>

            <p style={styles.subtitle}>
              Running with <span style={styles.subtitleHighlight}>Vatts.js</span>
            </p>
          </div>
        </div>
      </div>
  );
}`;
  }

  base += `

export const config: RouteConfig = {
    pattern: '/',
    component: Welcome,
    generateMetadata: () => ({
        title: 'Vatts.js | Home'
    })
};

export default config;
`;

  return base;
}

export function backendExampleRouteTemplate() {
  return `import {BackendRouteConfig, VattsRequest, VattsResponse} from "vatts"

const ExampleRoute: BackendRouteConfig = {
    pattern: '/api/example',
    GET(request: VattsRequest, params) {
        return VattsResponse.json({
            message: 'Welcome to the Example API!'
        })
    },
    POST: async (request: VattsRequest, params) => {
        const data = await request.json();
        return VattsResponse.json({
            message: 'POST request received at Example API!',
            body: data
        })
    }
};

export default ExampleRoute;`;
}
