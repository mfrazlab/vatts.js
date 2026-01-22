/*
 * This file is part of the Vatts.js Project.
 * Copyright (c) 2026 itsmuzin
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import React from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import { RouteConfig, Metadata } from './types';
import { getLayout } from './router';
import type { GenericRequest, GenericResponse } from './types/framework';
import fs from 'fs';
import path from 'path';
import Console, {Colors} from './api/console';

// --- Helpers de Servidor ---

// Função auxiliar para importar módulos ignorando CSS (mesma lógica do router.ts)
function requireWithoutStyles<T>(modulePath: string): T {
    const extensions = ['.css', '.scss', '.sass', '.less', '.png', '.jpg', '.jpeg', '.gif', '.svg'];
    const originalHandlers: Record<string, any> = {};

    extensions.forEach(ext => {
        originalHandlers[ext] = require.extensions[ext];
        require.extensions[ext] = (m: any, filename: string) => {
            m.exports = {};
        };
    });

    try {
        const resolved = require.resolve(modulePath);
        if (require.cache[resolved]) delete require.cache[resolved];
        return require(modulePath);
    } catch (e) {
        return require(modulePath);
    } finally {
        extensions.forEach(ext => {
            if (originalHandlers[ext]) {
                require.extensions[ext] = originalHandlers[ext];
            } else {
                delete require.extensions[ext];
            }
        });
    }
}

// --- Funções de Metadata e Scripts ---

function generateMetaTags(metadata: Metadata): string {
    const tags: string[] = [];
    tags.push(`<meta charset="${metadata.charset || 'UTF-8'}">`);
    tags.push(`<meta name="viewport" content="${metadata.viewport || 'width=device-width, initial-scale=1.0'}">`);

    if (metadata.description) tags.push(`<meta name="description" content="${metadata.description}">`);

    if (metadata.keywords) {
        const keywordsStr = Array.isArray(metadata.keywords) ? metadata.keywords.join(', ') : metadata.keywords;
        tags.push(`<meta name="keywords" content="${keywordsStr}">`);
    }

    if (metadata.author) tags.push(`<meta name="author" content="${metadata.author}">`);
    if (metadata.themeColor) tags.push(`<meta name="theme-color" content="${metadata.themeColor}">`);
    if (metadata.robots) tags.push(`<meta name="robots" content="${metadata.robots}">`);
    if (metadata.canonical) tags.push(`<link rel="canonical" href="${metadata.canonical}">`);
    if (metadata.favicon) tags.push(`<link rel="icon" href="${metadata.favicon}">`);

    // Apple & Manifest
    if (metadata.appleTouchIcon) tags.push(`<link rel="apple-touch-icon" href="${metadata.appleTouchIcon}">`);
    if (metadata.manifest) tags.push(`<link rel="manifest" href="${metadata.manifest}">`);

    // Open Graph
    if (metadata.openGraph) {
        const og = metadata.openGraph;
        if (og.title) tags.push(`<meta property="og:title" content="${og.title}">`);
        if (og.description) tags.push(`<meta property="og:description" content="${og.description}">`);
        if (og.type) tags.push(`<meta property="og:type" content="${og.type}">`);
        if (og.url) tags.push(`<meta property="og:url" content="${og.url}">`);
        if (og.siteName) tags.push(`<meta property="og:site_name" content="${og.siteName}">`);
        if (og.locale) tags.push(`<meta property="og:locale" content="${og.locale}">`);

        if (og.image) {
            const imgUrl = typeof og.image === 'string' ? og.image : og.image.url;
            tags.push(`<meta property="og:image" content="${imgUrl}">`);

            if (typeof og.image !== 'string') {
                if (og.image.width) tags.push(`<meta property="og:image:width" content="${og.image.width}">`);
                if (og.image.height) tags.push(`<meta property="og:image:height" content="${og.image.height}">`);
                if (og.image.alt) tags.push(`<meta property="og:image:alt" content="${og.image.alt}">`);
            }
        }
    }

    // Twitter Card
    if (metadata.twitter) {
        const tw = metadata.twitter;
        if (tw.card) tags.push(`<meta name="twitter:card" content="${tw.card}">`);
        if (tw.site) tags.push(`<meta name="twitter:site" content="${tw.site}">`);
        if (tw.creator) tags.push(`<meta name="twitter:creator" content="${tw.creator}">`);
        if (tw.title) tags.push(`<meta name="twitter:title" content="${tw.title}">`);
        if (tw.description) tags.push(`<meta name="twitter:description" content="${tw.description}">`);
        if (tw.image) tags.push(`<meta name="twitter:image" content="${tw.image}">`);
        if (tw.imageAlt) tags.push(`<meta name="twitter:image:alt" content="${tw.imageAlt}">`);
    }

    // Custom Meta Tags
    if (metadata.other) {
        for (const [key, value] of Object.entries(metadata.other)) {
            tags.push(`<meta name="${key}" content="${value}">`);
        }
    }

    return tags.join('\n');
}

function obfuscateData(data: any): string {
    const jsonStr = JSON.stringify(data);
    const base64 = Buffer.from(jsonStr).toString('base64');
    const hash = Buffer.from(Date.now().toString()).toString('base64').substring(0, 8);
    return `${hash}.${base64}`;
}

// Retorna as URLs dos scripts para o bootstrapModules do React
// Retorna null se não encontrar scripts (indica que o build ainda não terminou)
function getJavaScriptUrls(req: GenericRequest): string[] | null {
    const projectDir = process.cwd();
    const distDir = path.join(projectDir, '.vatts');

    if (!fs.existsSync(distDir)) return null;

    try {
        const manifestPath = path.join(distDir, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            const files = Object.values(manifest)
                .filter((file: any) => file.endsWith('.js'))
                .map((file: any) => `/_vatts/${file}`);
            return files.length > 0 ? files as string[] : null;
        } else {
            const jsFiles = fs.readdirSync(distDir)
                .filter(file => file.endsWith('.js') && !file.endsWith('.map'))
                .sort((a, b) => {
                    if (a.includes('main')) return -1;
                    if (b.includes('main')) return 1;
                    return a.localeCompare(b);
                });

            return jsFiles.length > 0 ? jsFiles.map(file => `/_vatts/${file}`) : null;
        }
    } catch {
        return null;
    }
}

// --- Componentes de Servidor ---

interface ServerRootProps {
    lang: string;
    title: string;
    metaTagsHtml: string;
    initialDataScript: string;
    hotReloadScript: string;
    dataScript: React.ReactNode;
    children: React.ReactNode;
}

function ServerRoot({ lang, title, metaTagsHtml, initialDataScript, hotReloadScript, dataScript, children }: ServerRootProps) {
    // Concatena tudo que vai no head em uma única string
    const headContent = `
        <meta charset="utf-8" />
        <title>${title}</title>
        ${initialDataScript ? `<script>${initialDataScript}</script>` : ''}
        ${metaTagsHtml || ''}
    `;

    return (
        <html lang={lang}>
        {/* O React não vai tentar hidratar o conteúdo interno, eliminando o erro e o script injetor */}
        <head dangerouslySetInnerHTML={{ __html: headContent }} />

        <body>
        {dataScript}

        <div id="root">{children}</div>

        {/* Usa display: none para garantir que scripts extras não afetem o layout visual */}
        {hotReloadScript && (
            <div
                style={{ display: 'none' }}
                dangerouslySetInnerHTML={{ __html: hotReloadScript }}
            />
        )}
        </body>
        </html>
    );
}

// --- Renderização Principal ---

interface RenderOptions {
    req: GenericRequest;
    res: any; // Raw response object (ServerResponse)
    route: RouteConfig & { componentPath: string };
    params: Record<string, string>;
    allRoutes: (RouteConfig & { componentPath: string })[];
}

export async function renderAsStream({ req, res, route, params, allRoutes }: RenderOptions): Promise<void> {
    const { generateMetadata } = route;
    const isProduction = !(req as any).hwebDev;
    const hotReloadManager = (req as any).hotReloadManager;

    // 1. Verificar Build - Se não tiver scripts, retorna tela de Loading
    const bootstrapScripts = getJavaScriptUrls(req);

    if (!bootstrapScripts) {
        res.setHeader('Content-Type', 'text/html');
        // Usamos .end() diretamente para garantir que a resposta seja enviada sem stream
        res.end(getBuildingHTML());
        return;
    }

    // 2. Preparar Layout
    const layoutInfo = getLayout();
    let LayoutComponent: any = null;

    if (layoutInfo) {
        try {
            // Recarrega o componente de layout para ter acesso à função (o router só guarda metadata)
            const layoutModule = requireWithoutStyles<any>(path.resolve(process.cwd(), layoutInfo.componentPath));
            LayoutComponent = layoutModule.default;
        } catch (e) {
            console.error("Error loading layout component for SSR:", e);
        }
    }

    // 3. Preparar Metadata
    let metadata: Metadata = { title: 'Vatts App' };
    if (layoutInfo && layoutInfo.metadata) {
        metadata = { ...metadata, ...layoutInfo.metadata };
    }
    if (generateMetadata) {
        const routeMetadata = await Promise.resolve(generateMetadata(params, req));
        metadata = { ...metadata, ...routeMetadata };
    }

    // 4. Preparar Dados Iniciais
    const results = await Promise.all(
        allRoutes.map(async (r) => {
            let routeMeta: Metadata = {};
            if (r.generateMetadata) {
                routeMeta = await r.generateMetadata(params, req);
            }
            return {
                pattern: r.pattern,
                componentPath: r.componentPath,
                metadata: routeMeta,
            }
        })
    );

    const initialData = {
        routes: results,
        initialComponentPath: route.componentPath,
        initialParams: params,
    };

    // Scripts
    const obfuscatedData = obfuscateData(initialData);
    const hotReloadScript = !isProduction && hotReloadManager ? hotReloadManager.getClientScript() : '';
    const metaTagsHtml = generateMetaTags(metadata);
    const htmlLang = metadata.language || 'pt-BR';

    // 5. Componente da Página Atual
    const PageComponent = route.component;

    // Monta a árvore da aplicação
    let AppTree = <PageComponent params={params} />;
    if (LayoutComponent) {
        AppTree = <LayoutComponent>{AppTree}</LayoutComponent>;
    }

    // 6. Streaming
    return new Promise((resolve, reject) => {
        let didError = false;

        const { pipe } = renderToPipeableStream(
            <ServerRoot
                lang={htmlLang}
                title={metadata.title || 'Vatts.js'}
                metaTagsHtml={metaTagsHtml}
                // Recriando o script de dados exatamente como o client espera
                initialDataScript={`/* Data Injection */`}
                hotReloadScript={hotReloadScript}
                dataScript={
                    <script
                        id="__vatts_data__"
                        type="text/plain"
                        data-h={obfuscatedData}
                    />
                }
            >
                {/* Injetamos o script de dados como um elemento React para garantir que esteja no DOM */}
                {AppTree}
            </ServerRoot>,
            {
                // Usar bootstrapModules para scripts tipo módulo (ESM)
                bootstrapModules: bootstrapScripts,
                onShellReady() {
                    res.setHeader('Content-Type', 'text/html');
                    pipe(res);
                    resolve();
                },
                onShellError(error: any) {
                    console.error('Streaming Shell Error:', error);
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'text/html');
                    res.end('<h1>Internal Server Error</h1>');
                    resolve();
                },
                onError(error: any) {
                    didError = true;
                    console.error('Streaming Error:', error);
                }
            }
        );
    });
}

// Mantemos a função antiga para compatibilidade
export async function render(options: any): Promise<string> {
    return "";
}

// Função para retornar HTML de "Build em andamento" com auto-refresh
function getBuildingHTML(): string {
    let version = "1.0.0";
    try {
        version = require("../package.json").version;
    } catch(e) {}

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vatts.js | Building...</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-solid: #0d0d0d;
            --card-bg: rgba(10, 10, 12, 0.95);
            /* CORES ALTERADAS: Cyan para Laranja/Vermelho */
            --primary: #ff6b35;
            --primary-glow: rgba(255, 107, 53, 0.5);
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
        }

        body {
            margin: 0;
            padding: 0;
            width: 100vw;
            height: 100vh;
            background-color: var(--bg-solid);
            font-family: 'Inter', sans-serif;
            color: var(--text-main);
            overflow: hidden;
            position: relative;
        }

        /* Centralização Absoluta Perfeita */
        .container {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            display: flex;
            justify-content: center;
            align-items: center;
            width: 100%;
            pointer-events: none;
        }

        .build-card {
            pointer-events: auto;
            position: relative;
            width: 100%;
            max-width: 420px;
            background: var(--card-bg);
            /* COR ALTERADA: Borda laranja sutil */
            box-shadow: 0 0 0 1px rgba(255, 107, 53, 0.15), 0 40px 80px -20px rgba(0, 0, 0, 0.8);
            border-radius: 20px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
        }


        .neon-line {
            height: 1px;
            width: 100%;
            /* COR ALTERADA: Gradiente Laranja/Vermelho */
            background: linear-gradient(90deg, transparent, #e85d04, #ff6b35, transparent);
            box-shadow: 0 0 15px var(--primary-glow);
        }

        .content {
            padding: 40px 32px;
            width: 100%;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        /* Logo Animation */
        .logo-wrapper {
            position: relative;
            margin-bottom: 24px;
        }
        
        .logo-wrapper img {
            width: 64px;
            height: 64px;
            object-fit: contain;
            position: relative;
            z-index: 2;
        }

        .logo-glow {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 100%;
            height: 100%;
            /* COR ALTERADA: Brilho da logo */
            background: var(--primary);
            filter: blur(25px);
            opacity: 0.2;
            border-radius: 50%;
            animation: pulse 2s ease-in-out infinite;
        }

        h1 {
            margin: 0;
            font-size: 2rem;
            font-weight: 800;
            letter-spacing: -0.03em;
            background: linear-gradient(180deg, #ffffff 0%, #94a3b8 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        h1 span {
            /* COR ALTERADA: ".js" */
            color: var(--primary);
            -webkit-text-fill-color: var(--primary);
        }

        p {
            margin: 8px 0 32px 0;
            color: var(--text-muted);
            font-size: 0.9rem;
            font-weight: 500;
        }

        /* Terminal de Progresso Falso */
        .terminal-box {
            width: 100%;
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            padding: 16px;
            text-align: left;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.75rem;
            color: #64748b;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .term-line {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .term-spinner {
            width: 10px;
            height: 10px;
            /* COR ALTERADA: Spinner animado */
            border: 2px solid rgba(255, 107, 53, 0.2);
            border-top-color: var(--primary);
            border-radius: 50%;
            animation: spin 0.6s linear infinite;
        }

        .file-name { color: var(--text-muted); }
        /* COR ALTERADA: Texto de destaque no terminal */
        .accent { color: var(--primary); }

        /* Footer Status */
        .card-footer {
            width: 100%;
            padding: 12px 32px;
            background: rgba(0,0,0,0.3);
            border-top: 1px solid rgba(255,255,255,0.03);
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11px;
            color: rgba(255,255,255,0.2);
            box-sizing: border-box;
        }

        .status-active {
            display: flex;
            align-items: center;
            gap: 6px;
            /* COR ALTERADA: Texto Hot Reload */
            color: var(--primary);
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .dot {
            width: 6px;
            height: 6px;
            /* COR ALTERADA: Pontinho brilhante */
            background-color: var(--primary);
            border-radius: 50%;
            box-shadow: 0 0 8px var(--primary);
        }

        @keyframes pulse {
            0%, 100% { opacity: 0.15; transform: translate(-50%, -50%) scale(1); }
            50% { opacity: 0.25; transform: translate(-50%, -50%) scale(1.2); }
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="build-card">
            <div class="neon-line"></div>
            
            <div class="content">
                <div class="logo-wrapper">
                    <div class="logo-glow"></div>
                    <img src="https://raw.githubusercontent.com/mfrazlab/vatts.js/master/docs/public/logo-v.png" alt="Vatts Logo">
                </div>

                <h1>Vatts<span>.js</span></h1>
                <p>Building your masterpiece...</p>

                <div class="terminal-box">
                    <div class="term-line">
                        <div class="term-spinner"></div>
                        <span class="file-name">Compiling <span class="accent">src/vatts.ts</span>...</span>
                    </div>
                    <div class="term-line" style="opacity: 0.5;">
                        <span>✓</span>
                        <span class="file-name">Optimizing assets</span>
                    </div>
                </div>
            </div>

            <div class="card-footer">
                <span>Building...</span>
                <div class="status-active">
                    <div class="dot"></div>
                    v${version}
                </div>
            </div>
        </div>
    </div>

    <script>
        setTimeout(() => {
            window.location.reload();
        }, 2500);
    </script>
</body>
</html>`;
}