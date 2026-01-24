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
import BuildingScreen from "./client/BuildingPage";

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

// --- Gerenciamento de Console (Silenciador) ---

const originalConsole = {
    log: console.log,
    info: console.info,
    debug: console.debug
};

function silenceConsole() {
    console.log = () => {};
    console.info = () => {};
    console.debug = () => {};
}

function restoreConsole() {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.debug = originalConsole.debug;
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

// Retorna as URLs dos scripts e CSS
// Procura em .vatts/ e .vatts/assets/
function getBuildAssets(req: GenericRequest): BuildAssets | null {
    const projectDir = process.cwd();
    const distDir = path.join(projectDir, '.vatts');
    const assetsDir = path.join(distDir, 'assets');

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
                if (file.endsWith('.js')) {
                    scripts.push(`${urlPrefix}/${file}`);
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
                .filter((f: any) => f.endsWith('.js'))
                .map((f: any) => `/_vatts/${f}`);

            styles = manifestFiles
                .filter((f: any) => f.endsWith('.css'))
                .map((f: any) => `/_vatts/${f}`);
        } else {
            // 2. Fallback: Scan manual de diretórios

            // Scan na raiz .vatts/ (Geralmente entry points)
            processDirectory(distDir, '/_vatts');

            // Scan em .vatts/assets/ (Assets estáticos, chunks, CSS extraído)
            processDirectory(assetsDir, '/_vatts/assets');

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

export async function renderAsStream({ req, res, route, params, allRoutes }: RenderOptions): Promise<void> {
    const { generateMetadata } = route;
    const isProduction = !(req as any).hwebDev;
    const hotReloadManager = (req as any).hotReloadManager;

    // SILENCIAR CONSOLE: Inicia o silêncio para evitar logs de renderização
    silenceConsole();

    try {
        // 1. Verificar Build - Se não tiver scripts, retorna tela de Loading
        const assets = getBuildAssets(req);

        if (!assets || assets.scripts.length === 0) {
            // Se falhar o build, restauramos o console para o erro aparecer se necessário
            restoreConsole();

            // Usando stream para a tela de loading também, agora via React Component
            const { pipe } = renderToPipeableStream(<BuildingScreen />, {
                onShellReady() {
                    res.setHeader('Content-Type', 'text/html');
                    pipe(res);
                }
            });
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
                // Usamos console.error original aqui, pois erro de layout é crítico
                restoreConsole();
                console.error("Error loading layout component for SSR:", e);
                silenceConsole(); // Volta a silenciar
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

        // 6. Streaming
        return new Promise((resolve, reject) => {
            let didError = false;

            const { pipe } = renderToPipeableStream(
                <ServerRoot
                    lang={htmlLang}
                    title={metadata.title || 'Vatts.js'}
                    metaTagsHtml={metaTagsHtml}
                    stylesHtml={stylesHtml} // Passando CSS
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
                    bootstrapModules: assets.scripts,
                    onShellReady() {
                        // Restaurar console assim que o shell estiver pronto (cabeçalho enviado)
                        restoreConsole();
                        res.setHeader('Content-Type', 'text/html');
                        pipe(res);
                        resolve();
                    },
                    onShellError(error: any) {
                        restoreConsole(); // Restaura para mostrar o erro real
                        console.error('Streaming Shell Error:', error);
                        res.statusCode = 500;
                        res.setHeader('Content-Type', 'text/html');
                        res.end('<h1>Internal Server Error</h1>');
                        resolve();
                    },
                    onError(error: any) {
                        didError = true;
                        // Log de erro de stream ainda é importante, mas podemos filtrar se quiser
                        // Aqui mantemos o log de erro original do React que vai para stderr
                        console.error('Streaming Error:', error);
                    }
                }
            );
        });
    } catch (err) {
        restoreConsole();
        console.error("Critical Render Error:", err);
        throw err;
    }
}

// Mantemos a função antiga para compatibilidade
export async function render(options: any): Promise<string> {
    return "";
}

// --- Componente de Tela de Building (Substituto do getBuildingHTML) ---

