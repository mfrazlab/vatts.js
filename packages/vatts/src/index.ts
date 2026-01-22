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
import {render} from './renderer';
import {VattsRequest, VattsResponse} from './api/http';
import {HotReloadManager} from './hotReload';
import {FrameworkAdapterFactory} from './adapters/factory';
import {GenericRequest, GenericResponse} from './types/framework';
import Console, {Colors} from "./api/console"

// RPC
import { executeRpc } from './rpc/server';
import { RPC_ENDPOINT } from './rpc/types';

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

        // Considera projeto grande se:
        // - Mais de 20 arquivos de frontend/style
        // - Ou tamanho total > 500KB
        return totalFiles > 20 || totalSize > 500 * 1024;
    } catch (error) {
        // Em caso de erro, assume que não é um projeto grande
        return false;
    }
}

// Função para gerar o arquivo de entrada para o esbuild
function createEntryFile(projectDir: string, routes: (RouteConfig & { componentPath: string })[]): string {
    try {
        const tempDir = path.join(projectDir, '.vatts', 'temp');

        fs.mkdirSync(tempDir, { recursive: true });

        const entryFilePath = path.join(tempDir, 'entry.client.js');
        // Verifica se há layout
        const layout = getLayout();

        // Verifica se há notFound personalizado
        const notFound = getNotFound();

        // Gera imports dinâmicos para cada componente
        const imports = routes
            .map((route, index) => {
                const relativePath = path.relative(tempDir, route.componentPath).replace(/\\/g, '/');
                return `import route${index} from '${relativePath}';`;
            })
            .join('\n');

        // Import do layout se existir
        const layoutImport = layout
            ? `import LayoutComponent from '${path.relative(tempDir, layout.componentPath).replace(/\\/g, '/')}';`
            : '';

        // Import do notFound se existir
        const notFoundImport = notFound
            ? `import NotFoundComponent from '${path.relative(tempDir, notFound.componentPath).replace(/\\/g, '/')}';`
            : '';

        // Registra os componentes no window para o cliente acessar
        const componentRegistration = routes
            .map((route, index) => `  '${route.componentPath}': route${index}.component || route${index}.default?.component,`)
            .join('\n');

        // Registra o layout se existir
        const layoutRegistration = layout
            ? `window.__VATTS_LAYOUT__ = LayoutComponent.default || LayoutComponent;`
            : `window.__VATTS_LAYOUT__ = null;`;

        // Registra o notFound se existir
        const notFoundRegistration = notFound
            ? `window.__VATTS_NOT_FOUND__ = NotFoundComponent.default || NotFoundComponent;`
            : `window.__VATTS_NOT_FOUND__ = null;`;

        // Caminho correto para o entry.client
        // IMPORTANT: quando o pacote é instalado via npm, bundlers (Rollup/Vite/etc.) não transpilam TSX em node_modules.
        // Por isso, aqui a gente sempre aponta para os artefatos compilados em dist/.
        const sdkDir = path.dirname(__dirname); // pasta do pacote (pai de dist/ e src/)

        const entryClientPath = path.join(sdkDir, 'dist', 'client', 'entry.client.js');
        const relativeEntryPath = path.relative(tempDir, entryClientPath).replace(/\\/g, '/');

        // Import do DefaultNotFound do SDK (compilado)
        const defaultNotFoundPath = path.join(sdkDir, 'dist', 'client', 'DefaultNotFound.js');
        const relativeDefaultNotFoundPath = path.relative(tempDir, defaultNotFoundPath).replace(/\\/g, '/');

        const entryContent = `// Arquivo gerado automaticamente pelo vatts
${imports}
${layoutImport}
${notFoundImport}
import DefaultNotFound from '${relativeDefaultNotFoundPath}';

// Registra os componentes para o cliente
window.__VATTS_COMPONENTS__ = {
${componentRegistration}
};

// Registra o layout se existir
${layoutRegistration}

// Registra o notFound se existir
${notFoundRegistration}


window.__VATTS_DEFAULT_NOT_FOUND__ = DefaultNotFound;

// Importa e executa o entry.client.tsx
import '${relativeEntryPath}';
`;

        try {
            fs.writeFileSync(entryFilePath, entryContent);
        } catch (e) {
            console.error("sdfijnsdfnijfsdijnfsdnijsdfnijfsdnijfsdnijfsdn", e)
        }

        return entryFilePath;
    }catch (e){
        Console.error("Error creating entry file:", e);
        throw e;
    }
}

export default function vatts(options: VattsOptions) {
    const { dev = true, dir = process.cwd(), port = 3000 } = options;
    // @ts-ignore
    process.vatts = options;
    const userWebDir = path.join(dir, 'src', 'web');
    const userWebRoutesDir = path.join(userWebDir, 'routes');
    const userBackendRoutesDir = path.join(dir, 'src', 'backend', 'routes');

    /**
     * Executa middlewares sequencialmente e depois o handler final
     * @param middlewares Array de middlewares para executar
     * @param finalHandler Handler final da rota
     * @param request Requisição do Vatts.js
     * @param params Parâmetros da rota
     * @returns Resposta do middleware ou handler final
     */
    async function executeMiddlewareChain(
        middlewares: VattsMiddleware[] | undefined,
        finalHandler: BackendHandler,
        request: VattsRequest,
        params: { [key: string]: string }
    ): Promise<VattsResponse> {
        if (!middlewares || middlewares.length === 0) {
            // Não há middlewares, executa diretamente o handler final
            return await finalHandler(request, params);
        }

        let currentIndex = 0;

        // Função next que será chamada pelos middlewares
        const next = async (): Promise<VattsResponse> => {
            if (currentIndex < middlewares.length) {
                // Ainda há middlewares para executar
                const currentMiddleware = middlewares[currentIndex];
                currentIndex++;
                return await currentMiddleware(request, params, next);
            } else {
                // Todos os middlewares foram executados, chama o handler final
                return await finalHandler(request, params);
            }
        };

        // Inicia a cadeia de execução
        return await next();
    }

    let frontendRoutes: (RouteConfig & { componentPath: string })[] = [];
    let hotReloadManager: HotReloadManager | null = null;
    let entryPoint: string;
    let outfile: string;

    // Função para regenerar o entry file
    const regenerateEntryFile = () => {
        // Recarrega todas as rotas e componentes
        const newFrontendRoutes = loadRoutes(userWebRoutesDir);
        const newLayout = loadLayout(userWebDir);
        const newNotFound = loadNotFound(userWebDir);

        // Se nada mudou, não reescreve o entry file (evita disparar rebuild extra)
        const oldKey = frontendRoutes.map(r => `${(r as any).pattern ?? ''}:${r.componentPath}`).join('|');
        const newKey = newFrontendRoutes.map(r => `${(r as any).pattern ?? ''}:${r.componentPath}`).join('|');

        if (oldKey === newKey) {
            // Ainda atualiza refs internas de layout/notFound, mas evita re-gerar o entry.
            frontendRoutes = newFrontendRoutes;
            return;
        }

        frontendRoutes = newFrontendRoutes;

        // Regenera o entry file
        entryPoint = createEntryFile(dir, frontendRoutes);
    };

    return {
        prepare: async () => {
            const isProduction = !dev;

            if (!isProduction) {
                // Inicia hot reload apenas em desenvolvimento (com suporte ao main)
                hotReloadManager = new HotReloadManager(dir);
                await hotReloadManager.start();

                // Adiciona callback para recarregar TUDO quando qualquer arquivo mudar
                hotReloadManager.onBackendApiChange(() => {


                    loadBackendRoutes(userBackendRoutesDir);
                    processWebSocketRoutes(); // Processa rotas WS após recarregar backend
                });

                // Adiciona callback para regenerar entry file quando frontend mudar
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
            }, 100); // muda a cada 100ms
            // ORDEM IMPORTANTE: Carrega TUDO antes de criar o arquivo de entrada
            frontendRoutes = loadRoutes(userWebRoutesDir);
            loadBackendRoutes(userBackendRoutesDir);

            // Processa rotas WebSocket após carregar backend
            processWebSocketRoutes();

            // Carrega layout.tsx ANTES de criar o entry file
            const layout = loadLayout(userWebDir);

            const notFound = loadNotFound(userWebDir);

            const outDir = path.join(dir, '.vatts');
            fs.mkdirSync(outDir, {recursive: true});

            entryPoint = createEntryFile(dir, frontendRoutes);
            clearInterval(spinner1)
            timee.end(`Routes and components loaded in ${Date.now() - now}ms`);


            if (isProduction) {
                const time = Console.dynamicLine(`Starting client build`);

// Spinner
                const spinnerFrames = ['|', '/', '-', '\\'];
                let frameIndex = 0;

                const spinner = setInterval(() => {
                    time.update(`    ${Colors.FgYellow}${spinnerFrames[frameIndex]}${Colors.Reset}  Building...`);
                    frameIndex = (frameIndex + 1) % spinnerFrames.length;
                }, 100); // muda a cada 100ms

                const now = Date.now();
                await buildWithChunks(entryPoint, outDir, isProduction);
                const elapsed = Date.now() - now;

                clearInterval(spinner); // para o spinner
                time.update(""); // limpa a linha
                time.end(`Client build completed in ${elapsed}ms`);

                // Notifica o hot reload manager que o build foi concluído
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

            // verificar se dir/src/instrumentation.(tsx/jsx/js/ts) existe com regex
            const instrumentationFile = fs.readdirSync(path.join(dir, 'src')).find(file => /^vattsweb\.(tsx|jsx|js|ts)$/.test(file));
            if (instrumentationFile) {
                const instrumentationPath = path.join(dir, 'src', instrumentationFile);
                // dar require, e executar a função principal do arquivo
                const instrumentation = require(instrumentationPath);

                // Registra o listener de hot reload se existir
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
                // Detecta o framework e cria request/response genéricos
                const adapter = FrameworkAdapterFactory.detectFramework(req, res);
                const genericReq: GenericRequest = adapter.parseRequest(req);
                const genericRes: GenericResponse = adapter.createResponse(res);

                // Adiciona informações do hweb na requisição genérica
                (genericReq as any).hwebDev = dev;
                (genericReq as any).hotReloadManager = hotReloadManager;

                const {hostname} = req.headers;
                const method = (genericReq.method || 'GET').toUpperCase();
                const pathname = new URL(genericReq.url, `http://${hostname}:${port}`).pathname;

                // RPC endpoint (antes das rotas de backend)
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

                // 1. Verifica se é WebSocket upgrade para hot reload
                if (pathname === '/hweb-hotreload/' && genericReq.headers.upgrade === 'websocket' && hotReloadManager) {
                    // Framework vai chamar o evento 'upgrade' do servidor HTTP
                    return;
                }

                // 2. Primeiro verifica se é um arquivo estático da pasta public
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

                            // Para arquivos estáticos, usamos o método nativo do framework
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

                            // Para arquivos estáticos, usamos o método nativo do framework
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

                // 4. REMOVIDO: Verificação de arquivos React UMD - não precisamos mais
                // O React agora será bundlado diretamente no main.js

                // 5. Verifica se é uma rota de API (backend)
                const backendMatch = findMatchingBackendRoute(pathname, method);
                if (backendMatch) {
                    try {
                        const handler = backendMatch.route[method as keyof BackendRouteConfig] as BackendHandler;
                        if (handler) {
                            const hwebReq = new VattsRequest(genericReq);

                            // Executa middlewares e depois o handler final
                            const hwebRes = await executeMiddlewareChain(
                                backendMatch.route.middleware,
                                handler,
                                hwebReq,
                                backendMatch.params
                            );

                            // Aplica a resposta usando o adapter correto
                            hwebRes._applyTo(genericRes);
                            return;
                        }
                    } catch (error) {
                        Console.error(`API route error ${pathname}:`, error);
                        genericRes.status(500).text('Internal server error in API');
                        return;
                    }
                }

                // 6. Por último, tenta renderizar uma página (frontend) ou 404
                const pageMatch = findMatchingRoute(pathname);

                if (!pageMatch) {
                    // Em vez de enviar texto simples, renderiza a página 404 React
                    try {
                        // Cria uma "rota falsa" para a página 404
                        const notFoundRoute = {
                            pattern: '/__404__',
                            component: () => null, // Componente vazio, será tratado no cliente
                            componentPath: '__404__'
                        };

                        const html = await render({
                            req: genericReq,
                            route: notFoundRoute,
                            params: {},
                            allRoutes: frontendRoutes
                        });
                        genericRes.status(404).header('Content-Type', 'text/html').send(html);
                        return;
                    } catch (error) {
                        Console.error(`Error rendering page 404:`, error);
                        genericRes.status(404).text('Page not found');
                        return;
                    }
                }

                try {
                    const html = await render({
                        req: genericReq,
                        route: pageMatch.route,
                        params: pageMatch.params,
                        allRoutes: frontendRoutes
                    });
                    genericRes.status(200).header('Content-Type', 'text/html').send(html);
                } catch (error) {
                    Console.error(`Error rendering page ${pathname}:`, error);
                    genericRes.status(500).text('Internal server error');
                }
            };
        },

        // Método para configurar WebSocket upgrade nos servidores Express e Fastify
        setupWebSocket: (server: any) => {
            // Detecta se é um servidor Express ou Fastify
            const isExpressServer = FrameworkAdapterFactory.getCurrentAdapter() instanceof ExpressAdapter;
            const actualServer = isExpressServer ? server : (server.server || server);

            // Usa o sistema coordenado de WebSocket upgrade que integra hot-reload e rotas de usuário
            setupWebSocketUpgrade(actualServer, hotReloadManager);
        },


        stop: () => {
            if (hotReloadManager) {
                hotReloadManager.stop();
            }
        }
    };
}

