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

import path from 'path';
import fs from 'fs';
import {ExpressAdapter} from './adapters/express';
import {build, buildWithChunks, watch, watchWithChunks} from './builder';
import {
    BackendHandler,
    BackendRouteConfig,
    VattsOptions,
    VattsMiddleware,
    RequestHandler,
    RouteConfig
} from './types';
import {
    findMatchingBackendRoute,
    findMatchingRoute,
    getLayout,
    getNotFound,
    loadBackendRoutes,
    loadLayout,
    loadNotFound,
    loadRoutes,
    processWebSocketRoutes,
    setupWebSocketUpgrade
} from './router';
import { renderAsStream } from './renderer'; // Usando a nova função de streaming
import {VattsRequest, VattsResponse} from './api/http';
import {HotReloadManager} from './hotReload';
import {FrameworkAdapterFactory} from './adapters/factory';
import {GenericRequest, GenericResponse} from './types/framework';
import Console, {Colors} from "./api/console"
import { loadEnv } from './env/env';

// RPC
import { executeRpc } from './rpc/server';
import { RPC_ENDPOINT } from './rpc/types';
import {config} from "./helpers";

// Helpers de segurança para servir arquivos estáticos sem path traversal
function isSuspiciousPathname(p: string): boolean {
    try {
        const decoded = decodeURIComponent(p);
        return decoded.includes('\0') || decoded.includes('..');
    } catch {
        return true;
    }
}

function resolveWithin(baseDir: string, unsafePath: string): string | null {
    const rel = unsafePath.replace(/^\/+/, '');
    const absBase = path.resolve(baseDir);
    const abs = path.resolve(absBase, rel);
    const baseWithSep = absBase.endsWith(path.sep) ? absBase : absBase + path.sep;
    if (abs !== absBase && !abs.startsWith(baseWithSep)) return null;
    return abs;
}

// Exporta apenas os tipos e classes para o backend
export { VattsRequest, VattsResponse };
export type { BackendRouteConfig, BackendHandler };

// Exporta os adapters para uso manual se necessário
export { ExpressAdapter } from './adapters/express';
export { FastifyAdapter } from './adapters/fastify';
export { FrameworkAdapterFactory } from './adapters/factory';
export type { GenericRequest, GenericResponse, CookieOptions } from './types/framework';

// Exporta os helpers para facilitar integração
export { app } from './helpers';

// Exporta o sistema de WebSocket
export type { WebSocketContext, WebSocketHandler } from './types';

// Exporta os tipos de configuração
export type { VattsConfig, VattsConfigFunction } from './types';

// Função para verificar se o projeto é grande o suficiente para se beneficiar de chunks
function isLargeProject(projectDir: string): boolean {
    try {
        const srcDir = path.join(projectDir, 'src');
        if (!fs.existsSync(srcDir)) return false;

        let totalFiles = 0;
        let totalSize = 0;

        function scanDirectory(dir: string) {
            const items = fs.readdirSync(dir, { withFileTypes: true });

            for (const item of items) {
                const fullPath = path.join(dir, item.name);

                if (item.isDirectory() && item.name !== 'node_modules' && item.name !== '.git') {
                    scanDirectory(fullPath);
                } else if (item.isFile() && /\.(tsx?|jsx?|css|scss|less)$/i.test(item.name)) {
                    totalFiles++;
                    totalSize += fs.statSync(fullPath).size;
                }
            }
        }

        scanDirectory(srcDir);

        return totalFiles > 20 || totalSize > 500 * 1024;
    } catch (error) {
        return false;
    }
}

// Função para gerar o arquivo de entrada para o esbuild
function createEntryFile(projectDir: string, routes: (RouteConfig & { componentPath: string })[]): string {
    try {
        const tempDir = path.join(projectDir, '.vatts', 'temp');

        fs.mkdirSync(tempDir, { recursive: true });

        const entryFilePath = path.join(tempDir, 'entry.client.js');
        const layout = getLayout();
        const notFound = getNotFound();

        const imports = routes
            .map((route, index) => {
                const relativePath = path.relative(tempDir, route.componentPath).replace(/\\/g, '/');
                return `import route${index} from '${relativePath}';`;
            })
            .join('\n');

        const layoutImport = layout
            ? `import LayoutComponent from '${path.relative(tempDir, layout.componentPath).replace(/\\/g, '/')}';`
            : '';

        const notFoundImport = notFound
            ? `import NotFoundComponent from '${path.relative(tempDir, notFound.componentPath).replace(/\\/g, '/')}';`
            : '';

        let componentRegistration: string;
        if(config?.pathRouter === true) {
            componentRegistration = routes
                .map((route, index) => `  '${route.componentPath}': route${index} || route${index}.default,`)
                .join('\n');
        } else {
            componentRegistration = routes
                .map((route, index) => `  '${route.componentPath}': route${index}.component || route${index}.default?.component,`)
                .join('\n');
        }

        const layoutRegistration = layout
            ? `window.__VATTS_LAYOUT__ = LayoutComponent.default || LayoutComponent;`
            : `window.__VATTS_LAYOUT__ = null;`;

        const notFoundRegistration = notFound
            ? `window.__VATTS_NOT_FOUND__ = NotFoundComponent.default || NotFoundComponent;`
            : `window.__VATTS_NOT_FOUND__ = null;`;

        const sdkDir = path.dirname(__dirname);
        const entryClientPath = path.join(sdkDir, 'dist', 'client', 'entry.client.js');
        const relativeEntryPath = path.relative(tempDir, entryClientPath).replace(/\\/g, '/');
        const defaultNotFoundPath = path.join(sdkDir, 'dist', 'client', 'DefaultNotFound.js');
        const relativeDefaultNotFoundPath = path.relative(tempDir, defaultNotFoundPath).replace(/\\/g, '/');

        const entryContent = `// Arquivo gerado automaticamente pelo vatts
${imports}
${layoutImport}
${notFoundImport}
import DefaultNotFound from '${relativeDefaultNotFoundPath}';

window.__VATTS_COMPONENTS__ = {
${componentRegistration}
};

${layoutRegistration}
${notFoundRegistration}

window.__VATTS_DEFAULT_NOT_FOUND__ = DefaultNotFound;

import '${relativeEntryPath}';
`;

        try {
            fs.writeFileSync(entryFilePath, entryContent);
        } catch (e) {
            console.error("Error writing entry file", e)
        }

        return entryFilePath;
    }catch (e){
        Console.error("Error creating entry file:", e);
        throw e;
    }
}

export default function vatts(options: VattsOptions) {
    const { dev = true, dir = process.cwd(), port = 3000, envFiles } = options;
    loadEnv({ dir, dev, envFiles });
    // @ts-ignore
    process.vatts = options;
    // @ts-ignore
    process.env.PORT = options.port
    const userWebDir = path.join(dir, 'src', 'web');
    const userWebRoutesDir = path.join(userWebDir, 'routes');
    const userBackendRoutesDir = path.join(dir, 'src', 'backend', 'routes');

    async function executeMiddlewareChain(
        middlewares: VattsMiddleware[] | undefined,
        finalHandler: BackendHandler,
        request: VattsRequest,
        params: { [key: string]: string }
    ): Promise<VattsResponse> {
        if (!middlewares || middlewares.length === 0) {
            return await finalHandler(request, params);
        }

        let currentIndex = 0;

        const next = async (): Promise<VattsResponse> => {
            if (currentIndex < middlewares.length) {
                const currentMiddleware = middlewares[currentIndex];
                currentIndex++;
                return await currentMiddleware(request, params, next);
            } else {
                return await finalHandler(request, params);
            }
        };

        return await next();
    }

    let frontendRoutes: (RouteConfig & { componentPath: string })[] = [];
    let hotReloadManager: HotReloadManager | null = null;
    let entryPoint: string;

    const regenerateEntryFile = () => {
        const newFrontendRoutes = loadRoutes(userWebRoutesDir);
        const newLayout = loadLayout(userWebDir);
        const newNotFound = loadNotFound(userWebDir);

        const oldKey = frontendRoutes.map(r => `${(r as any).pattern ?? ''}:${r.componentPath}`).join('|');
        const newKey = newFrontendRoutes.map(r => `${(r as any).pattern ?? ''}:${r.componentPath}`).join('|');

        if (oldKey === newKey) {
            frontendRoutes = newFrontendRoutes;
            return;
        }

        frontendRoutes = newFrontendRoutes;
        entryPoint = createEntryFile(dir, frontendRoutes);
    };

    return {
        prepare: async () => {
            const isProduction = !dev;

            if (!isProduction) {
                hotReloadManager = new HotReloadManager(dir);
                await hotReloadManager.start();

                hotReloadManager.onBackendApiChange(() => {
                    loadBackendRoutes(userBackendRoutesDir);
                    processWebSocketRoutes();
                });

                hotReloadManager.onFrontendChange(() => {
                    regenerateEntryFile();
                });
            }
            const now = Date.now();
            const timee = Console.dynamicLine(`Loading routes and components`);
            const spinnerFrames1 = ['|', '/', '-', '\\'];
            let frameIndex1 = 0;

            const spinner1 = setInterval(() => {
                timee.update(`   ${Colors.FgYellow}${spinnerFrames1[frameIndex1]}${Colors.Reset}  Loading routes and components...`);
                frameIndex1 = (frameIndex1 + 1) % spinnerFrames1.length;
            }, 100);

            frontendRoutes = loadRoutes(userWebRoutesDir);
            loadBackendRoutes(userBackendRoutesDir);

            processWebSocketRoutes();

            const layout = loadLayout(userWebDir);
            const notFound = loadNotFound(userWebDir);

            const outDir = path.join(dir, '.vatts');
            fs.mkdirSync(outDir, {recursive: true});

            entryPoint = createEntryFile(dir, frontendRoutes);
            clearInterval(spinner1)
            timee.end(`Routes and components loaded in ${Date.now() - now}ms`);


            if (isProduction) {
                const time = Console.dynamicLine(`Starting client build`);
                const spinnerFrames = ['|', '/', '-', '\\'];
                let frameIndex = 0;

                const spinner = setInterval(() => {
                    time.update(`    ${Colors.FgYellow}${spinnerFrames[frameIndex]}${Colors.Reset}  Building...`);
                    frameIndex = (frameIndex + 1) % spinnerFrames.length;
                }, 100);

                const now = Date.now();
                await buildWithChunks(entryPoint, outDir, isProduction);
                const elapsed = Date.now() - now;

                clearInterval(spinner);
                time.update("");
                time.end(`Client build completed in ${elapsed}ms`);

                if (hotReloadManager) {
                    hotReloadManager.onBuildComplete(true);
                }

            } else {
                const time = Console.dynamicLine(`  ${Colors.BgYellow} watcher ${Colors.Reset}  Starting client watch`);
                // @ts-ignore
                watchWithChunks(entryPoint, outDir, hotReloadManager!).catch(err => {
                    Console.error(`Error starting watch`, err);
                });
                time.end(`Client Watch started`);
            }

        },

        executeInstrumentation: () => {
            const instrumentationFile = fs.readdirSync(path.join(dir, 'src')).find(file => /^vattsweb\.(js|ts)$/.test(file));
            if (instrumentationFile) {
                const instrumentationPath = path.join(dir, 'src', instrumentationFile);
                const instrumentation = require(instrumentationPath);

                if (instrumentation.hotReloadListener && typeof instrumentation.hotReloadListener === 'function') {
                    if (hotReloadManager) {
                        hotReloadManager.setHotReloadListener(instrumentation.hotReloadListener);
                    }
                }

                if (typeof instrumentation === 'function') {
                    instrumentation();
                } else if (typeof instrumentation.default === 'function') {
                    instrumentation.default();
                } else {
                    Console.warn(`The instrumentation file ${instrumentationFile} does not export a default function.`);
                }
            }
        },
        getRequestHandler: (): RequestHandler => {
            return async (req: any, res: any) => {
                const adapter = FrameworkAdapterFactory.detectFramework(req, res);
                const genericReq: GenericRequest = adapter.parseRequest(req);
                const genericRes: GenericResponse = adapter.createResponse(res);

                (genericReq as any).hwebDev = dev;
                (genericReq as any).hotReloadManager = hotReloadManager;

                const {hostname} = req.headers;
                const method = (genericReq.method || 'GET').toUpperCase();
                const pathname = new URL(genericReq.url, `http://${hostname}:${port}`).pathname;

                if (pathname === RPC_ENDPOINT && method === 'POST') {
                    try {
                        const result = await executeRpc(
                            {
                                projectDir: dir,
                                request: genericReq
                            },
                            genericReq.body
                        );
                        genericRes.header('Content-Type', 'application/json');
                        genericRes.status(200).send(JSON.stringify(result));
                        return;
                    } catch (error) {
                        genericRes.header('Content-Type', 'application/json');
                        genericRes.status(200).send(JSON.stringify({ success: false, error: 'Internal RPC error' }));
                        return;
                    }
                }

                if (pathname === '/hweb-hotreload/' && genericReq.headers.upgrade === 'websocket' && hotReloadManager) {
                    return;
                }

                if (pathname !== '/' && !pathname.startsWith('/api/') && !pathname.startsWith('/.vatts')) {
                    const publicDir = path.join(dir, 'public');

                    if (!isSuspiciousPathname(pathname)) {
                        const filePath = resolveWithin(publicDir, pathname);
                        if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                            const ext = path.extname(filePath).toLowerCase();
                            const contentTypes: Record<string, string> = {
                                '.html': 'text/html',
                                '.css': 'text/css',
                                '.js': 'application/javascript',
                                '.json': 'application/json',
                                '.png': 'image/png',
                                '.jpg': 'image/jpeg',
                                '.jpeg': 'image/jpeg',
                                '.gif': 'image/gif',
                                '.svg': 'image/svg+xml',
                                '.ico': 'image/x-icon',
                                '.webp': 'image/webp',
                                '.mp4': 'video/mp4',
                                '.webm': 'video/webm',
                                '.mp3': 'audio/mpeg',
                                '.wav': 'audio/wav',
                                '.pdf': 'application/pdf',
                                '.txt': 'text/plain',
                                '.xml': 'application/xml',
                                '.zip': 'application/zip'
                            };

                            genericRes.header('Content-Type', contentTypes[ext] || 'application/octet-stream');

                            if (adapter.type === 'express') {
                                (res as any).sendFile(filePath);
                            } else if (adapter.type === 'fastify') {
                                const fileContent = fs.readFileSync(filePath);
                                genericRes.send(fileContent);
                            } else if (adapter.type === 'native') {
                                const fileContent = fs.readFileSync(filePath);
                                genericRes.send(fileContent);
                            }
                            return;
                        }
                    }
                }


                if (pathname.startsWith('/_vatts/')) {
                    const staticPath = path.join(dir, '.vatts');
                    const requestPath = pathname.replace('/_vatts/', '');

                    if (!isSuspiciousPathname(requestPath)) {
                        const filePath = resolveWithin(staticPath, requestPath);
                        if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                            const ext = path.extname(filePath).toLowerCase();
                            const contentTypes: Record<string, string> = {
                                '.js': 'application/javascript',
                                '.css': 'text/css',
                                '.map': 'application/json'
                            };

                            genericRes.header('Content-Type', contentTypes[ext] || 'text/plain');

                            if (adapter.type === 'express') {
                                (res as any).sendFile(filePath);
                            } else if (adapter.type === 'fastify') {
                                const fileContent = fs.readFileSync(filePath);
                                genericRes.send(fileContent);
                            } else if (adapter.type === 'native') {
                                const fileContent = fs.readFileSync(filePath);
                                genericRes.send(fileContent);
                            }
                            return;
                        }
                    }
                }

                const backendMatch = findMatchingBackendRoute(pathname, method);
                if (backendMatch) {
                    try {
                        const handler = backendMatch.route[method as keyof BackendRouteConfig] as BackendHandler;
                        if (handler) {
                            const hwebReq = new VattsRequest(genericReq);

                            const hwebRes = await executeMiddlewareChain(
                                backendMatch.route.middleware,
                                handler,
                                hwebReq,
                                backendMatch.params
                            );

                            hwebRes._applyTo(genericRes);
                            return;
                        }
                    } catch (error) {
                        Console.error(`API route error ${pathname}:`, error);
                        genericRes.status(500).text('Internal server error in API');
                        return;
                    }
                }

                // Renderização de Página (Frontend)
                const pageMatch = findMatchingRoute(pathname);

                // Determina o objeto de resposta "cru" para o stream do React
                // Se for Fastify, o Writable stream está em res.raw. Se for Express/Native, é o próprio res.
                const rawRes = (res.raw || res);

                if (!pageMatch) {
                    try {
                        const notFoundRoute = {
                            pattern: '/__404__',
                            component: () => null, // Será renderizado via SSR se tiver componente de 404 definido no Client
                            componentPath: '__404__'
                        };

                        // Tenta usar componente 404 customizado se houver
                        const notFound = getNotFound();
                        if (notFound) {
                            // Carrega o componente 404 real para o SSR funcionar
                            try {
                                const nfModule = require(path.resolve(process.cwd(), notFound.componentPath));
                                // @ts-ignore
                                notFoundRoute.component = nfModule.default || nfModule;
                            } catch(e) {}
                        }

                        // Define status 404 antes de iniciar o stream
                        if (rawRes.statusCode) rawRes.statusCode = 404; // Native/Fastify
                        if (rawRes.status) rawRes.status(404); // Express (mas pode quebrar se for raw, melhor usar statusCode)

                        await renderAsStream({
                            req: genericReq,
                            res: rawRes,
                            route: notFoundRoute,
                            params: {},
                            allRoutes: frontendRoutes
                        });
                        return;
                    } catch (error) {
                        Console.error(`Error rendering page 404:`, error);
                        genericRes.status(404).text('Page not found');
                        return;
                    }
                }

                try {
                    // Renderização via Stream (SSR + Streaming)
                    await renderAsStream({
                        req: genericReq,
                        res: rawRes,
                        route: pageMatch.route,
                        params: pageMatch.params,
                        allRoutes: frontendRoutes
                    });
                } catch (error) {
                    Console.error(`Error rendering page ${pathname}:`, error);
                    // Se o stream já começou, não dá pra enviar erro 500 limpo.
                    // O renderAsStream tenta lidar com isso no onError.
                    if (!rawRes.headersSent) {
                        genericRes.status(500).text('Internal server error');
                    }
                }
            };
        },

        setupWebSocket: (server: any) => {
            const isExpressServer = FrameworkAdapterFactory.getCurrentAdapter() instanceof ExpressAdapter;
            const actualServer = isExpressServer ? server : (server.server || server);
            setupWebSocketUpgrade(actualServer, hotReloadManager);
        },

        stop: () => {
            if (hotReloadManager) {
                hotReloadManager.stop();
            }
        }
    };
}