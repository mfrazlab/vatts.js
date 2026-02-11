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
import {Metadata, RouteConfig} from '../types';
import {getLayout} from '../router';
import type {GenericRequest} from '../types/framework';
import fs from 'fs';
import path from 'path';

import * as vue from "vue"

import * as vueServerRenderer from "@vue/server-renderer"
import BuildingPage from "./BuildingPage.vue";
import ServerErrorPage from "./server-error.vue";

function getRequestUrl(req: GenericRequest): string | undefined {
    return (req as any)?.originalUrl || (req as any)?.url;
}

function buildVueShellDocument(options: {
    lang: string;
    title: string;
    metaTagsHtml: string;
    scriptPreloadsHtml: string;
    componentPreloadsHtml: string;
    stylesHtml: string;
    obfuscatedData: string;
    scriptsHtml: string;
    hotReloadScript: string;
    bodyInnerHtml: string;
}): string {
    const {
        lang,
        title,
        metaTagsHtml,
        scriptPreloadsHtml,
        componentPreloadsHtml,
        stylesHtml,
        obfuscatedData,
        scriptsHtml,
        hotReloadScript,
        bodyInnerHtml,
    } = options;

    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="utf-8" />
    <title>${title}</title>
    ${metaTagsHtml}
    ${scriptPreloadsHtml}
    ${componentPreloadsHtml}
    ${stylesHtml}
</head>
<body>
    <script id="__vatts_data__" type="text/plain" data-h="${obfuscatedData}"></script>
    <div id="root">${bodyInnerHtml || ''}</div>
    ${scriptsHtml}
    ${hotReloadScript ? `<div style="display:none">${hotReloadScript}</div>` : ''}
</body>
</html>`;
}

function stripScriptTags(html: string): string {
    if (!html) return '';
    return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
}

// --- Helpers de Servidor (Duplicados para manter isolamento) ---

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

function obfuscateData(data: any): string {
    const jsonStr = JSON.stringify(data);
    const base64 = Buffer.from(jsonStr).toString('base64');
    const hash = Buffer.from(Date.now().toString()).toString('base64').substring(0, 8);
    return `${hash}.${base64}`;
}

/**
 * Analisa o código fonte do componente para encontrar imports estáticos de assets
 * e gerar links de preload para injetar no head.
 * * ATUALIZADO: Verifica se o arquivo existe em .vatts/assets (com hash) antes de gerar o link.
 */
function extractComponentPreloads(componentPath: string): string[] {
    if (!componentPath || !fs.existsSync(componentPath)) return [];

    // Localização dos assets compilados para verificação de hash
    const assetsDir = path.join(process.cwd(), '.vatts', 'assets');
    let availableAssets: string[] = [];
    try {
        if (fs.existsSync(assetsDir)) {
            availableAssets = fs.readdirSync(assetsDir);
        }
    } catch (e) {
        // Silently fail if assets dir not found
    }

    // Função auxiliar para encontrar o arquivo real com hash
    const findHashedAsset = (filename: string): string | null => {
        // 1. Se o arquivo existe exatamente como pedido
        if (availableAssets.includes(filename)) return filename;

        // 2. Procura por versão com hash (ex: style.css -> style.CjdCylXW.css ou da8dfae3-style.CjdCylXW.css)
        const ext = path.extname(filename);
        const base = path.basename(filename, ext); // "style"
        
        // Filtra arquivos que terminam com a extensão correta e contêm o nome base
        // Isso garante que pegamos o arquivo hasheado gerado pelo build
        const match = availableAssets.find(asset => 
            asset.endsWith(ext) && asset.includes(base)
        );

        return match || null;
    };

    try {
        const content = fs.readFileSync(componentPath, 'utf8');
        const tags: Set<string> = new Set();

        const processPath = (fullPath: string) => {
            const filename = path.basename(fullPath);
            
            // VERIFICAÇÃO DE HASH:
            // Tenta encontrar o nome real do arquivo na pasta de assets.
            // Se não encontrar (retornar null), ignoramos o arquivo para não gerar link quebrado (404).
            const realFilename = findHashedAsset(filename);

            if (!realFilename) {
                return; // Bloqueia a entrada se não tiver correspondente hash/físico
            }

            const ext = path.extname(realFilename).toLowerCase();
            // Usa o nome real encontrado (com hash)
            const publicUrl = `/_vatts/assets/${realFilename}`;

            if (['.mp4', '.webm'].includes(ext)) {
                tags.add(`<link rel="preload" as="video" href="${publicUrl}">`);
            } else if (['.css'].includes(ext)) {
                tags.add(`<link rel="preload" as="style" href="${publicUrl}">`);
                tags.add(`<link rel="stylesheet" href="${publicUrl}">`);
            } else if (['.js', '.js.br', '.js.gz'].includes(ext)) {
                // Adicionado suporte para JS
                tags.add(`<link rel="preload" as="script" href="${publicUrl.replace(".br", '').replace(".gz", '')}">`);
            } else if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif'].includes(ext)) {
                tags.add(`<link rel="preload" as="image" href="${publicUrl}">`);
            }
        };

        // 1. Imports (ESM) & Requires (CJS)
        // Captura:
        // - import foo from './foo.png' (Named import)
        // - import './style.css' (Side-effect import)
        // - require('./image.jpg') (CommonJS)
        // Adicionado |js na lista de extensões
        const importRegex = /(?:import(?:\s+[^;'"]+\s+from)?\s+|require\(\s*)['"]([^'"]+\.(png|jpg|jpeg|gif|svg|webp|avif|mp4|webm|css|js))['"]/g;

        let match;
        while ((match = importRegex.exec(content)) !== null) {
            processPath(match[1]);
        }

        // 2. Imagens no Template (src="...")
        // Captura caminhos relativos ou absolutos de imagens hardcoded no HTML do Vue
        const imgTagRegex = /<img\s+[^>]*src=['"]([^'"]+\.(png|jpg|jpeg|gif|svg|webp|avif))['"]/g;
        while ((match = imgTagRegex.exec(content)) !== null) {
            const src = match[1];
            // Para tags img src, também processamos para tentar achar a versão hash
            processPath(src); 
        }

        return Array.from(tags);
    } catch (e) {
        console.warn(`Failed to extract preloads for ${componentPath}:`, e);
        return [];
    }
}

/**
 * Garante que o componente Vue esteja carregado e compilado corretamente.
 * Se o loader falhar em trazer o template (render function), compilamos manualmente aqui.
 */
function ensureVueComponent(existingComponent: any, componentPath: string): any {
    let component = existingComponent;

    // 1. Se não temos o componente objeto, tentamos carregar do disco
    if (!component && componentPath) {
        try {
            const module = requireWithoutStyles<any>(componentPath);
            component = module.default || module;
        } catch (e) {
            console.error(`Error loading component from ${componentPath}:`, e);
            return null;
        }
    }

    if (!component) return null;

    // 2. Correção Crítica: Se o componente existe mas não tem render/ssrRender
    // (comum quando o loader processa o script mas esquece o template)
    if (typeof component === 'object' && !component.render && !component.ssrRender && componentPath && componentPath.endsWith('.vue')) {
        try {
            // Requer as dependências de compilação dinamicamente
            let sfc, esbuild;
            try {
                sfc = require('vue/compiler-sfc');
                esbuild = require('esbuild');
            } catch (e) {
                // Se não tiver as ferramentas de build, não podemos corrigir
                return component;
            }

            const source = fs.readFileSync(componentPath, 'utf8');
            const { descriptor } = sfc.parse(source, { filename: componentPath });

            if (descriptor.template) {
                // Tenta obter bindings do script para otimização (opcional, mas bom para setup)
                let bindings;
                if (descriptor.script || descriptor.scriptSetup) {
                    try {
                        const scriptResult = sfc.compileScript(descriptor, { id: componentPath });
                        bindings = scriptResult.bindings;
                    } catch (e) { /* Ignora erro de script pois já foi processado pelo loader */ }
                }

                // Compila o template especificamente para SSR
                const templateResult = sfc.compileTemplate({
                    source: descriptor.template.content,
                    filename: componentPath,
                    id: componentPath,
                    compilerOptions: {
                        bindingMetadata: bindings
                    },
                    ssr: true,
                    isProd: false,
                    // CORREÇÃO: Passa as variáveis CSS para evitar erro no SSR
                    ssrCssVars: descriptor.cssVars || []
                });

                if (templateResult.code) {
                    // Transforma o código ESM gerado pelo Vue em CJS para rodar no Node
                    const transformed = esbuild.transformSync(templateResult.code, {
                        loader: 'js',
                        format: 'cjs',
                        target: 'node16'
                    });

                    // Sandbox simples para executar o código do template e extrair a função ssrRender
                    const mod = { exports: {} as any };
                    const req = (id: string) => {
                        if (id === 'vue') return require('vue');
                        if (id === '@vue/server-renderer') return require('@vue/server-renderer');
                        return require(id);
                    };

                    const runModule = new Function('module', 'exports', 'require', transformed.code);
                    runModule(mod, mod.exports, req);

                    // Anexa a função render compilada ao componente existente
                    if (mod.exports.ssrRender) {
                        component.ssrRender = mod.exports.ssrRender;
                    }
                    if (mod.exports.render && !component.render) {
                        component.render = mod.exports.render;
                    }
                }
            }
        } catch (e) {
            console.warn(`Failed to manually compile template for ${componentPath}:`, e);
        }
    }

    return component;
}

// --- Funções de Metadata ---

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

interface BuildAssets {
    scripts: string[];
    styles: string[];
}

function getBuildAssets(req: GenericRequest): BuildAssets | null {
    const projectDir = process.cwd();
    const distDir = path.join(projectDir, '.vatts');
    const assetsDir = path.join(distDir, 'assets');

    if (!fs.existsSync(distDir)) return null;

    let scripts: string[] = [];
    let styles: string[] = [];

    const processDirectory = (directory: string, urlPrefix: string) => {
        if (!fs.existsSync(directory)) return;
        const files = fs.readdirSync(directory);
        files.forEach(file => {
            if (file.endsWith('.map')) return;
            const fullPath = path.join(directory, file);
            if (fs.statSync(fullPath).isFile()) {
                if (file.endsWith('.js') || file.endsWith(".js.br") || file.endsWith(".js.gz")) scripts.push(`${urlPrefix}/${file.replace(".br", '').replace(".gz", '')}`);
                else if (file.endsWith('.css')) styles.push(`${urlPrefix}/${file}`);
            }
        });
    };

    try {
        const manifestPath = path.join(distDir, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            const manifestFiles = Object.values(manifest);
            scripts = manifestFiles.filter((f: any) => f.endsWith('.js') || f.endsWith(".js.br")).map((f: any) => `/_vatts/${f.replace('.br', '')}`);
            styles = manifestFiles.filter((f: any) => f.endsWith('.css')).map((f: any) => `/_vatts/${f}`);
        } else {
            processDirectory(distDir, '/_vatts');
            processDirectory(assetsDir, '/_vatts/assets');
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

interface RenderOptions {
    req: GenericRequest;
    res: any;
    route: RouteConfig & { componentPath: string };
    params: Record<string, string>;
    allRoutes: (RouteConfig & { componentPath: string })[];
}

export async function renderVue({ req, res, route, params, allRoutes }: RenderOptions): Promise<void> {
    if (!vue) {
        res.statusCode = 500;
        res.end('Vue dependencies not installed.');
        return;
    }
    if (!vueServerRenderer) {
        res.statusCode = 500;
        res.end('Vue server dependencies not installed.');
        return;
    }

    const { createSSRApp, h } = vue;
    const { renderToNodeStream, renderToString } = vueServerRenderer as any;
    const { generateMetadata } = route;
    const isProduction = !(req as any).hwebDev;
    const hotReloadManager = (req as any).hotReloadManager;

    let assets: BuildAssets | null = null;
    let metadata: Metadata = { title: 'Vatts App' };
    let layoutInfo: any = null;

    const sendShell = async (options: {
        error?: unknown;
        bodyInnerHtml: string;
        statusCode: number;
        includeScripts?: boolean;
    }) => {
        const includeScripts = options.includeScripts !== false;
        if (!assets) {
            if (!res.headersSent) {
                res.statusCode = options.statusCode;
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.end(isProduction ? '' : '<h1>SSR Error</h1>');
            }
            return;
        }

        const hotReloadScript = includeScripts && !isProduction && hotReloadManager ? hotReloadManager.getClientScript() : '';
        let metaTagsHtml = (() => {
            try {
                return generateMetaTags(metadata);
            } catch {
                return '';
            }
        })();
        if (!includeScripts) {
            metaTagsHtml = stripScriptTags(metaTagsHtml);
        }
        const htmlLang = metadata.language || 'pt-BR';
        const title = metadata.title || 'Vatts.js';

        const scriptPreloadsHtml = includeScripts
            ? assets.scripts.map((src) => `<link rel="modulepreload" href="${src}">`).join('\n')
            : '';
        const componentPreloadsHtml = includeScripts
            ? (() => {
                  try {
                      const componentPreloads = extractComponentPreloads(
                          route.componentPath ? path.resolve(process.cwd(), route.componentPath) : ''
                      );
                      return componentPreloads.join('\n');
                  } catch {
                      return '';
                  }
              })()
            : '';
        const stylesHtml = assets.styles.map((styleUrl) => `<link rel="stylesheet" href="${styleUrl}">`).join('\n');
        const scriptsHtml = includeScripts
            ? assets.scripts.map((src) => `<script type="module" src="${src}"></script>`).join('\n')
            : '';

        const obfuscatedData = (() => {
            try {
                return obfuscateData({
                    routes: [],
                    initialComponentPath: route.componentPath,
                    initialParams: params,
                });
            } catch {
                return '';
            }
        })();

        res.statusCode = options.statusCode;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(
            buildVueShellDocument({
                lang: htmlLang,
                title,
                metaTagsHtml,
                scriptPreloadsHtml,
                componentPreloadsHtml,
                stylesHtml,
                obfuscatedData,
                scriptsHtml,
                hotReloadScript,
                bodyInnerHtml: options.bodyInnerHtml,
            })
        );
    };

    const sendSsrError = async (error: unknown) => {
        if (isProduction) {
            await sendShell({ bodyInnerHtml: '', statusCode: 200, includeScripts: true });
            return;
        }

        try {
            const ErrorRoot = {
                setup() {
                    return () =>
                        h(ServerErrorPage as any, {
                            error,
                            requestUrl: getRequestUrl(req),
                            hint: 'O SSR falhou ao renderizar essa rota. Veja o erro abaixo.',
                        });
                },
            };
            const errorApp = createSSRApp(ErrorRoot);
            const errorHtml = await renderToString(errorApp);
            await sendShell({ bodyInnerHtml: errorHtml, statusCode: 500, includeScripts: false });
        } catch {
            await sendShell({ bodyInnerHtml: '<h1>SSR Error</h1>', statusCode: 500, includeScripts: false });
        }
    };

    try {
        assets = getBuildAssets(req);

        if (!assets || assets.scripts.length === 0) {

            const RootComponent = {
                setup() {
                    return () => {
                        return BuildingPage ? h(BuildingPage as any, {params}) : h('div', 'Page not found/loaded');
                    };
                }
            };

            const app = createSSRApp(RootComponent);

            // 5. Stream
            const stream = renderToNodeStream(app);

            res.setHeader('Content-Type', 'text/html');
            // enviar stream direto
            stream.pipe(res, { end: false });
            stream.on('end', () => {
                res.end()
            })
            return;
        }

        // 1. Layout (Carrega e Corrige se necessário)
        layoutInfo = getLayout();
        let LayoutComponent: any = null;
        if (layoutInfo) {
            LayoutComponent = ensureVueComponent(null, path.resolve(process.cwd(), layoutInfo.componentPath));
        }

        // 2. Metadata
        if (layoutInfo && layoutInfo.metadata) {
            metadata = { ...metadata, ...layoutInfo.metadata };
        }
        if (generateMetadata) {
            const routeMetadata = await Promise.resolve(generateMetadata(params, req));
            metadata = { ...metadata, ...routeMetadata };
        }

        // 3. Initial Data
        const results = await Promise.all(
            allRoutes.map(async (r) => {
                let routeMeta: Metadata = {};
                if (r.generateMetadata) {
                    routeMeta = await r.generateMetadata(params, req);
                }
                if (!routeMeta.title) {
                    routeMeta.title = layoutInfo?.metadata.title || 'Vatts App';
                }
                return {
                    pattern: r.pattern,
                    componentPath: r.componentPath,
                    metadata: routeMeta,
                };
            })
        );

        const initialData = {
            routes: results,
            initialComponentPath: route.componentPath,
            initialParams: params,
        };

        const obfuscatedData = obfuscateData(initialData);
        const hotReloadScript = !isProduction && hotReloadManager ? hotReloadManager.getClientScript() : '';
        const metaTagsHtml = generateMetaTags(metadata);
        const htmlLang = metadata.language || 'pt-BR';

        // Otimização: Adiciona modulepreload para scripts principais do bundle
        const scriptPreloadsHtml = assets.scripts.map(src => `<link rel="modulepreload" href="${src}">`).join('\n');

        // Otimização: Intercepta assets do componente atual para preload
        const componentPreloads = extractComponentPreloads(route.componentPath ? path.resolve(process.cwd(), route.componentPath) : '');
        const componentPreloadsHtml = componentPreloads.join('\n');

        const stylesHtml = assets.styles.map(styleUrl => `<link rel="stylesheet" href="${styleUrl}">`).join('\n');
        const scriptsHtml = assets.scripts.map(src => `<script type="module" src="${src}"></script>`).join('\n');

        // 4. Create Vue App
        // Carrega o componente da rota e aplica a correção (compile template) se o loader falhou
        let PageComponent = ensureVueComponent(
            route.component,
            route.componentPath ? path.resolve(process.cwd(), route.componentPath) : ''
        );

        // Componente Root
        const RootComponent = {
            setup() {
                return () => {
                    const pageNode = PageComponent ? h(PageComponent as any, { params }) : h('div', 'Page not found/loaded');

                    if (LayoutComponent) {
                        return h(LayoutComponent, null, { default: () => pageNode });
                    }
                    return pageNode;
                };
            }
        };

        const app = createSSRApp(RootComponent);

        // 5. Render (usa renderToString para evitar HTML parcial e permitir fallback)
        try {
            const bodyInnerHtml = await renderToString(app);

            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(
                buildVueShellDocument({
                    lang: htmlLang,
                    title: metadata.title || 'Vatts.js',
                    metaTagsHtml,
                    scriptPreloadsHtml,
                    componentPreloadsHtml,
                    stylesHtml,
                    obfuscatedData,
                    scriptsHtml,
                    hotReloadScript,
                    bodyInnerHtml,
                })
            );
        } catch (err) {
            if (!isProduction) {
                console.error('Vue SSR Error:', err);
            }
            await sendSsrError(err);
        }

    } catch (err) {
        if (!isProduction) {
            console.error("Critical Vue Render Error:", err);
        }
        await sendSsrError(err);
    }
}