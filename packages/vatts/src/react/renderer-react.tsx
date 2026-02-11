/*
 * This file is part of the Vatts.js Project.
 * Copyright (c) 2026 mfraz
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
import { RouteConfig, Metadata } from '../types';
import { getLayout } from '../router';
import type { GenericRequest, GenericResponse } from '../types/framework';
import fs from 'fs';
import path from 'path';

import BuildingScreen from "../react/BuildingPage";
import ServerError from "../react/server-error";

function stripScriptTags(html: string): string {
    if (!html) return '';
    return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
}

function getRequestUrl(req: GenericRequest): string | undefined {
    return (req as any)?.originalUrl || (req as any)?.url;
}

function toError(err: unknown): Error {
    if (err instanceof Error) return err;
    if (typeof err === 'string') return new Error(err);
    try {
        return new Error(JSON.stringify(err));
    } catch {
        return new Error(String(err));
    }
}

function buildShellHtml(options: {
    lang: string;
    title: string;
    metaTagsHtml: string;
    stylesHtml: string;
    hotReloadScript: string;
    obfuscatedData: string;
    scriptsHtml?: string;
}): string {
    const { lang, title, metaTagsHtml, stylesHtml, hotReloadScript, obfuscatedData, scriptsHtml } = options;

    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="utf-8" />
    <title>${title}</title>
    ${metaTagsHtml || ''}
    ${stylesHtml || ''}
</head>
<body>
    <script id="__vatts_data__" type="text/plain" data-h="${obfuscatedData}"></script>
    <div id="root"></div>
    ${scriptsHtml || ''}
    ${hotReloadScript ? `<div style="display:none">${hotReloadScript}</div>` : ''}
</body>
</html>`;
}

async function sendReactSsrFallback(options: {
    req: GenericRequest;
    res: any;
    isProduction: boolean;
    error: unknown;
    assets: BuildAssets;
    lang: string;
    title: string;
    metaTagsHtml: string;
    stylesHtml: string;
    hotReloadScript: string;
    obfuscatedData: string;
}): Promise<void> {
    const {
        req,
        res,
        isProduction,
        error,
        assets,
        lang,
        title,
        metaTagsHtml,
        stylesHtml,
        hotReloadScript,
        obfuscatedData,
    } = options;

        const scriptsHtml = assets.scripts
            .map((src) => `<script type="module" src="${src}"></script>`)
            .join('\n');

        // No DEV a gente remove scripts do head pra garantir que só aparece a página de erro.
        const safeMetaTagsHtmlForDev = stripScriptTags(metaTagsHtml);

    if (res.headersSent) {
        try {
            res.end();
        } catch {
            // ignore
        }
        return;
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.statusCode = isProduction ? 200 : 500;

    if (isProduction) {
        res.end(
            buildShellHtml({
                lang,
                title,
                metaTagsHtml,
                stylesHtml,
                hotReloadScript: '',
                obfuscatedData,
                scriptsHtml,
            })
        );
        return;
    }

    const err = toError(error);

    return new Promise((resolve) => {
        const { pipe } = renderToPipeableStream(
            <ServerRoot
                lang={lang}
                title={title}
                metaTagsHtml={safeMetaTagsHtmlForDev}
                stylesHtml={stylesHtml}
                initialDataScript={`/* Data Injection */`}
                hotReloadScript={''}
                dataScript={
                    <script id="__vatts_data__" type="text/plain" data-h={obfuscatedData} />
                }
            >
                <ServerError
                    error={err}
                    requestUrl={getRequestUrl(req)}
                    hint="O SSR falhou ao renderizar essa rota. Veja o erro abaixo."
                />
            </ServerRoot>,
            {
                onAllReady() {
                    pipe(res);
                    resolve();
                },
                onError() {
                    // ignore (já estamos numa tela de erro)
                },
                onShellError() {
                    // fallback extremo
                    res.end('<h1>SSR Error</h1>');
                    resolve();
                },
            }
        );
    });
}

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
    if(metadata.scripts) {
        for(const [key, value] of Object.entries(metadata.scripts)) {
            const rest = Object.entries(value).map((r) => {
                return '' + r[0] + '="' + r[1] + '"'
            })
            tags.push(`<script src="${key}" ${rest.join(" ")}></script>`)
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

// Interface para retorno dos assets
interface BuildAssets {
    scripts: string[];
    styles: string[];
}

function getBuildAssets(req: GenericRequest): BuildAssets | null {
    const projectDir = process.cwd();
    const distDir = path.join(projectDir, '.vatts');
    const assetsDir = path.join(distDir, 'assets');
    const chunksDir = path.join(distDir, 'chunks');
    if (!fs.existsSync(distDir)) return null;

    let scripts: string[] = [];
    let styles: string[] = [];

    // Helper para processar arquivos de um diretório
    const processDirectory = (directory: string, urlPrefix: string) => {
        if (!fs.existsSync(directory)) return;

        const files = fs.readdirSync(directory);

        files.forEach(file => {
            if (file.endsWith('.map')) return; // Ignora sourcemaps

            const fullPath = path.join(directory, file);
            const stat = fs.statSync(fullPath);

            if (stat.isFile()) {
                // MODIFICADO: Aceita .js OU .js.bra
                if (file.endsWith('.js') || file.endsWith('.js.br') || file.endsWith('.js.gz')) {
                    scripts.push(`${urlPrefix}/${file.replace(".br", '').replace(".gz", '')}`);
                } else if (file.endsWith('.css')) {
                    styles.push(`${urlPrefix}/${file}`);
                }
            }
        });
    };

    try {
        // 1. Verificar Manifesto (se existir)
        const manifestPath = path.join(distDir, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            const manifestFiles = Object.values(manifest);

            scripts = manifestFiles
                // MODIFICADO: Filtra .js E .js.br no manifesto
                .filter((f: any) => f.endsWith('.js') || f.endsWith('.js.br') || f.endsWith('.js.gz'))
                .map((f: any) => `/_vatts/${f.replace(".br", "").replace(".gz", "")}`);

            styles = manifestFiles
                .filter((f: any) => f.endsWith('.css'))
                .map((f: any) => `/_vatts/${f}`);
        } else {
            // 2. Fallback: Scan manual de diretórios

            // Scan na raiz .vatts/ (Geralmente entry points)
            processDirectory(distDir, '/_vatts');

            // Scan em .vatts/assets/ (Assets estáticos, chunks, CSS extraído)
            processDirectory(assetsDir, '/_vatts/assets');
            processDirectory(chunksDir, '/_vatts/chunks');

            // Ordenação básica para garantir que o main carregue
            scripts.sort((a, b) => {
                if (a.includes('main')) return -1;
                if (b.includes('main')) return 1;
                return a.localeCompare(b);
            });
        }

        if (scripts.length === 0) return null;

        return { scripts, styles };

    } catch (e) {
        console.error("Error loading assets:", e);
        return null;
    }
}
// --- Componentes de Servidor ---

interface ServerRootProps {
    lang: string;
    title: string;
    metaTagsHtml: string;
    stylesHtml: string; // Novo prop para CSS
    initialDataScript: string;
    hotReloadScript: string;
    dataScript: React.ReactNode;
    children: React.ReactNode;
}

function ServerRoot({ lang, title, metaTagsHtml, stylesHtml, initialDataScript, hotReloadScript, dataScript, children }: ServerRootProps) {
    // Concatena tudo que vai no head em uma única string
    const headContent = `
        <meta charset="utf-8" />
        <title>${title}</title>
        ${initialDataScript ? `<script>${initialDataScript}</script>` : ''}
        ${metaTagsHtml || ''}
        ${stylesHtml || ''}
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

export async function render({ req, res, route, params, allRoutes }: RenderOptions): Promise<void> {
    const { generateMetadata } = route;
    const isProduction = !(req as any).hwebDev;
    const hotReloadManager = (req as any).hotReloadManager;

    // SILENCIAR CONSOLE: Inicia o silêncio para evitar logs de renderização


    let assets: BuildAssets | null = null;
    let metadata: Metadata = { title: 'Vatts App' };
    let layoutInfo: any = null;

    try {
        // 1. Verificar Build - Se não tiver scripts, retorna tela de Loading
        assets = getBuildAssets(req);

        if (!assets || assets.scripts.length === 0) {
            const { pipe } = renderToPipeableStream(<BuildingScreen />, {
                onShellReady() {
                    res.setHeader('Content-Type', 'text/html; charset=utf-8');
                    pipe(res);
                },
            });
            return;
        }

        // 2. Preparar Layout
        layoutInfo = getLayout();
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
                if(!routeMeta.title) {
                    routeMeta.title = layoutInfo?.metadata.title || 'Vatts App'
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

        // Scripts e Estilos
        const obfuscatedData = obfuscateData(initialData);
        const hotReloadScript = !isProduction && hotReloadManager ? hotReloadManager.getClientScript() : '';
        const metaTagsHtml = generateMetaTags(metadata);
        const htmlLang = metadata.language || 'pt-BR';

        // Gera tags de estilo para o head
        const stylesHtml = assets.styles.map(styleUrl => `<link rel="stylesheet" href="${styleUrl}">`).join('\n');

        // 5. Componente da Página Atual
        const PageComponent = route.component;

        // Monta a árvore da aplicação
        let AppTree = <PageComponent params={params} />;
        if (LayoutComponent) {
            AppTree = <LayoutComponent>{AppTree}</LayoutComponent>;
        }

        // 6. Streaming (segura até onAllReady para conseguir fallback sem HTML parcial)
        return new Promise((resolve) => {
            let didError = false;
            let firstError: unknown = null;

            const stream = renderToPipeableStream(
                <ServerRoot
                    lang={htmlLang}
                    title={metadata.title || 'Vatts.js'}
                    metaTagsHtml={metaTagsHtml}
                    stylesHtml={stylesHtml}
                    initialDataScript={`/* Data Injection */`}
                    hotReloadScript={hotReloadScript}
                    dataScript={<script id="__vatts_data__" type="text/plain" data-h={obfuscatedData} />}
                >
                    {AppTree}
                </ServerRoot>,
                {
                    bootstrapModules: assets!.scripts,
                    onAllReady() {
                        if (didError) {
                            stream.abort();
                            sendReactSsrFallback({
                                req,
                                res,
                                isProduction,
                                error: firstError || new Error('SSR error'),
                                assets: assets!,
                                lang: htmlLang,
                                title: metadata.title || 'Vatts.js',
                                metaTagsHtml,
                                stylesHtml,
                                hotReloadScript,
                                obfuscatedData,
                            }).then(resolve);
                            return;
                        }

                        res.setHeader('Content-Type', 'text/html; charset=utf-8');
                        stream.pipe(res);
                        resolve();
                    },
                    onShellError(error: any) {
                        firstError ||= error;
                        didError = true;
                    },
                    onError(error: any) {
                        firstError ||= error;
                        didError = true;
                        if (!isProduction) {
                            console.error('Streaming Error:', error);
                        }
                    },
                }
            );
        });
    } catch (err) {
        if (!assets) {
            // sem assets não dá pra montar shell completo; evita crash
            if (!res.headersSent) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.end(isProduction ? '' : '<h1>SSR Error</h1>');
            }
            return;
        }

        await sendReactSsrFallback({
            req,
            res,
            isProduction,
            error: err,
            assets,
            lang: (metadata as any)?.language || 'pt-BR',
            title: metadata.title || 'Vatts.js',
            metaTagsHtml: (() => {
                try {
                    return generateMetaTags(metadata);
                } catch {
                    return '';
                }
            })(),
            stylesHtml: assets.styles.map((styleUrl) => `<link rel="stylesheet" href="${styleUrl}">`).join('\n'),
            hotReloadScript: !isProduction && hotReloadManager ? hotReloadManager.getClientScript() : '',
            obfuscatedData: (() => {
                try {
                    return obfuscateData({
                        routes: [],
                        initialComponentPath: route.componentPath,
                        initialParams: params,
                    });
                } catch {
                    return '';
                }
            })(),
        });
    }
}