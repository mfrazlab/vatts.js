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
import fs from 'fs';
import path from 'path';
import { RouteConfig, BackendRouteConfig, VattsMiddleware, WebSocketHandler, WebSocketContext } from './types';
import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { URL } from 'url';
import Console from "./api/console"
import { FrameworkAdapterFactory } from "./adapters/factory";
import { VattsRequest } from "./api/http";
import {config} from "./helpers";

// --- Tipos Internos Otimizados ---

interface CompiledRoute {
    config: RouteConfig;
    componentPath: string;
    regex: RegExp; // Regex pré-compilada para performance
    paramNames: string[]; // Nomes dos parâmetros extraídos para evitar re-parse
}

interface CompiledBackendRoute {
    config: BackendRouteConfig;
    regex: RegExp;
    paramNames: string[];
}

// --- Estado Global ---

let allRoutes: CompiledRoute[] = [];
let allBackendRoutes: CompiledBackendRoute[] = [];
let allWebSocketRoutes: { regex: RegExp; handler: WebSocketHandler; middleware?: VattsMiddleware[]; config: BackendRouteConfig }[] = [];

// Cache de arquivos para Hot Reload
const loadedFiles = new Set<string>();

// Componentes Especiais
let layoutComponent: { componentPath: string; metadata?: any } | null = null;
let notFoundComponent: { componentPath: string } | null = null;

// Conexões ativas
let wsConnections: Set<WebSocket> = new Set();

// --- Helpers de Regex ---

// Re-implementação da compilação usando Named Groups para segurança e facilidade (como no original, mas cached)
function compileRoutePatternWithGroups(pattern: string): RegExp {
    const regexPattern = pattern
        .replace(/\[\[\.\.\.(\w+)\]\]/g, '(?<$1>.+)?')
        .replace(/\[\.\.\.(\w+)\]/g, '(?<$1>.+)')
        .replace(/\/\[\[(\w+)\]\]/g, '(?:/(?<$1>[^/]+))?')
        .replace(/\[\[(\w+)\]\]/g, '(?<$1>[^/]+)?')
        .replace(/\[(\w+)\]/g, '(?<$1>[^/]+)');

    return new RegExp(`^${regexPattern}/?$`);
}


// --- Gerenciamento de Cache ---

function safeClearCache(filePath: string) {
    try {
        // Tenta deletar direto pela chave do caminho absoluto (mais rápido)
        if (require.cache[filePath]) {
            delete require.cache[filePath];
            return;
        }

        // Fallback: resolve o caminho (tem custo de I/O)
        const resolved = require.resolve(filePath);
        if (require.cache[resolved]) {
            delete require.cache[resolved];
        }
    } catch (e) {
        // Ignora erro se arquivo não for resolvível
    }
}

export function clearAllRouteCache() {
    loadedFiles.forEach(file => safeClearCache(file));
    loadedFiles.clear();
}

export function clearFileCache(changedFilePath: string) {
    const absolutePath = path.resolve(changedFilePath);

    // Só tenta limpar se realmente já foi carregado (evita I/O desnecessário)
    if (loadedFiles.has(absolutePath)) {
        safeClearCache(absolutePath);
        loadedFiles.delete(absolutePath);
    }
}

/**
 * Hook para ignorar importações de CSS/SCSS/SASS durante o require do servidor.
 * Isso evita a necessidade de processar arquivos pesados que não afetam a rota.
 */
function requireWithoutStyles<T>(modulePath: string): T {
    const extensions = ['.css', '.scss', '.sass', '.less', '.png', '.jpg', '.jpeg', '.gif', '.svg'];
    const originalHandlers: Record<string, any> = {};

    // Salva handlers originais e substitui por no-op
    extensions.forEach(ext => {
        originalHandlers[ext] = require.extensions[ext];
        require.extensions[ext] = (m: NodeModule, filename: string) => {
            // Retorna módulo vazio para imports de estilo/assets
            // @ts-ignore
            m.exports = {};
        };
    });

    try {
        // Não chamamos safeClearCache aqui explicitamente; quem chama loadRoutes já deve ter gerenciado o ciclo
        return require(modulePath);
    } finally {
        // Restaura handlers originais
        extensions.forEach(ext => {
            if (originalHandlers[ext]) {
                require.extensions[ext] = originalHandlers[ext];
            } else {
                delete require.extensions[ext];
            }
        });
    }
}


// --- Carregamento de Layout (Otimizado - Sem I/O de Disco) ---

export function loadLayout(webDir: string): { componentPath: string; metadata?: any } | null {
    const extensions = ['layout.tsx', 'layout.jsx', 'layout.vue'];
    let layoutFile: string | null = null;

    for (const ext of extensions) {
        const fullPath = path.join(webDir, ext);
        if (fs.existsSync(fullPath)) {
            layoutFile = fullPath;
            break;
        }
    }

    if (layoutFile) {
        const absolutePath = path.resolve(layoutFile);
        const componentPath = path.relative(process.cwd(), layoutFile).replace(/\\/g, '/');

        try {
            // Se já carregamos antes, limpa o cache para garantir reload
            if (loadedFiles.has(absolutePath)) {
                safeClearCache(absolutePath);
            }

            // OTIMIZAÇÃO: Carrega em memória ignorando CSS
            const layoutModule = requireWithoutStyles<any>(layoutFile);

            loadedFiles.add(absolutePath);

            layoutComponent = {
                componentPath,
                metadata: layoutModule.metadata || null
            };
            return layoutComponent;
        } catch (error) {
            Console.error(`Error loading layout ${layoutFile}:`, error);
            layoutComponent = { componentPath };
            return layoutComponent;
        }
    }

    layoutComponent = null;
    return null;
}

export function getLayout() { return layoutComponent; }






// --- Carregamento de Rotas Frontend ---



// Helper para converter o caminho do arquivo no padrão de URL (Next.js style)
function convertPathToRoutePattern(absolutePath: string, routesDir: string): string {
    // 1. Pega o caminho relativo e normaliza as barras
    let relPath = path.relative(routesDir, absolutePath).replace(/\\/g, '/');

    // 2. Remove o nome do arquivo (page.tsx, page.ts, page.jsx, page.js ou page.vue) do final
    relPath = relPath.replace(/\/?page\.(?:tsx|ts|jsx|js|vue)$/, '');

    // 3. Remove os "Route Groups" do Next.js, ex: (auth)/login vira /login
    relPath = relPath.replace(/\/\([^)]+\)/g, '').replace(/^\([^)]+\)\/?/, '');

    // 4. Se a string ficou vazia, é a rota raiz
    if (!relPath) return '/';

    // 5. Garante que comece com "/"
    return '/' + relPath;
}

export function loadPathRoutes(routesDir: string): (RouteConfig & { componentPath: string })[] {
    if (!fs.existsSync(routesDir)) {
        allRoutes = [];
        return [];
    }

    const loaded: CompiledRoute[] = [];
    const cwdPath = process.cwd();

    const scanAndLoad = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const name = entry.name;

            // Ignora arquivos/pastas ocultas, de sistema ou de componentes (ex: _components)
            if (name.startsWith('.') || name.startsWith('_')) continue;

            const fullPath = path.join(dir, name);

            if (entry.isDirectory()) {
                if (name === 'backend' || name === 'api') continue;
                scanAndLoad(fullPath);
            } else if (entry.isFile() && (name === 'page.tsx' || name === 'page.ts' || name === 'page.jsx' || name === 'page.js' || name === 'page.vue')) {
                // SÓ carrega se for um arquivo "page"
                try {
                    const absolutePath = path.resolve(fullPath);

                    // OTIMIZAÇÃO: Limpa cache apenas se já existia
                    if (loadedFiles.has(absolutePath)) {
                        safeClearCache(absolutePath);
                    }

                    // Importa o módulo ignorando estilos
                    const routeModule = requireWithoutStyles<any>(absolutePath);

                    // O "default" agora é o Componente React/Vue em si
                    const PageComponent = routeModule.default;

                    if (PageComponent) {
                        const componentPath = path.relative(cwdPath, fullPath).replace(/\\/g, '/');

                        // Gera o pattern baseado na pasta (ex: /blog/[id])
                        const pattern = convertPathToRoutePattern(absolutePath, routesDir);

                        // Monta o config dinamicamente
                        const generatedConfig: RouteConfig = {
                            pattern,
                            component: PageComponent,
                            generateMetadata: routeModule.generateMetadata || (() => ({})),
                        };

                        // OTIMIZAÇÃO: Pré-compila a regex
                        const regex = compileRoutePatternWithGroups(pattern);

                        loaded.push({
                            config: generatedConfig,
                            componentPath,
                            regex,
                            paramNames: [] // Seus named groups cuidam disso
                        });

                        loadedFiles.add(absolutePath);
                    }
                } catch (error) {
                    Console.error(`Error loading page ${fullPath}:`, error);
                }
            }
        }
    };

    scanAndLoad(routesDir);

    // Ordena as rotas para que rotas estáticas tenham prioridade sobre rotas dinâmicas [id]
    loaded.sort((a, b) => {
        const aDynamic = a.config.pattern.includes('[');
        const bDynamic = b.config.pattern.includes('[');
        if (aDynamic && !bDynamic) return 1;
        if (!aDynamic && bDynamic) return -1;
        return b.config.pattern.length - a.config.pattern.length; // Mais específicas primeiro
    });

    allRoutes = loaded;
    return allRoutes.map(r => ({ ...r.config, componentPath: r.componentPath }));
}


export function loadRoutes(routesDir: string): (RouteConfig & { componentPath: string })[] {

    if(config?.pathRouter == true) {
        return loadPathRoutes(path.join(routesDir, "../"))
    }
    if (!fs.existsSync(routesDir)) {
        allRoutes = [];
        return [];
    }

    const loaded: CompiledRoute[] = [];
    const cwdPath = process.cwd();

    // Função recursiva otimizada
    const scanAndLoad = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const name = entry.name;
            // Skip arquivos ocultos ou de sistema para acelerar scan
            if (name.startsWith('.') || name.startsWith('_')) continue;

            const fullPath = path.join(dir, name);

            if (entry.isDirectory()) {
                if (name === 'backend') continue;
                scanAndLoad(fullPath);
            } else if (entry.isFile() && (name.endsWith('.tsx') || name.endsWith('.ts') || name.endsWith(".jsx") || name.endsWith(".js") || name.endsWith(".vue"))) {
                try {
                    const absolutePath = path.resolve(fullPath);

                    // OTIMIZAÇÃO CRÍTICA: Só limpa cache se o arquivo já foi carregado antes.
                    // Isso evita chamadas caras de require.resolve() na inicialização do servidor.
                    if (loadedFiles.has(absolutePath)) {
                        safeClearCache(absolutePath);
                    }

                    // OTIMIZAÇÃO: Usa requireWithoutStyles também para rotas!
                    // Isso evita que o Node tente processar imports de CSS/Assets dentro das páginas durante o roteamento.
                    const routeModule = requireWithoutStyles<any>(absolutePath);
                    let defaultConfig = routeModule.default
                    if(name.endsWith(".vue")) {
                        defaultConfig = {
                            ...routeModule.config,
                            component: routeModule.default
                        }

                    }

                    if (defaultConfig?.pattern && defaultConfig?.component) {

                        const componentPath = path.relative(cwdPath, fullPath).replace(/\\/g, '/');

                        // OTIMIZAÇÃO: Pré-compila a regex aqui
                        const regex = compileRoutePatternWithGroups(defaultConfig.pattern);

                        loaded.push({
                            config: defaultConfig,
                            componentPath,
                            regex,
                            paramNames: [] // Usando named groups na regex, não precisamos mapear manual
                        });

                        loadedFiles.add(absolutePath);
                    }
                } catch (error) {
                    Console.error(`Error loading route ${fullPath}:`, error);
                }
            }
        }
    };

    scanAndLoad(routesDir);

    // Atualiza variável global e retorna formato esperado pelo sistema (sem a regex exposta para não quebrar tipagem antiga se for estrita)
    allRoutes = loaded;
    return allRoutes.map(r => ({ ...r.config, componentPath: r.componentPath }));
}

export function findMatchingRoute(pathname: string) {
    // OTIMIZAÇÃO: Loop usando regex pré-compilada. Muito mais rápido.
    for (const route of allRoutes) {
        const match = pathname.match(route.regex);
        if (match) {
            return {
                route: { ...route.config, componentPath: route.componentPath },
                params: match.groups || {}
            };
        }
    }
    return null;
}


// --- Carregamento de Rotas Backend ---

// Cache de middlewares simples
const middlewareCache = new Map<string, VattsMiddleware[]>();

function getMiddlewaresForDir(dir: string): VattsMiddleware[] {
    if (middlewareCache.has(dir)) return middlewareCache.get(dir)!;

    const files = ['middleware.ts', 'middleware.js'];
    let middlewares: VattsMiddleware[] = [];

    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.existsSync(fullPath)) {
            try {
                const absolutePath = path.resolve(fullPath);
                if (loadedFiles.has(absolutePath)) {
                    safeClearCache(absolutePath);
                }

                // Middlewares backend não usam requireWithoutStyles pois não devem ter CSS,
                // e podem precisar de outros módulos backend.
                const mod = require(fullPath);
                loadedFiles.add(absolutePath);

                // Extração robusta de exports
                if (typeof mod.default === 'function') middlewares.push(mod.default);
                else if (Array.isArray(mod.default)) middlewares.push(...mod.default);

                Object.keys(mod).forEach(key => {
                    if (key !== 'default' && typeof mod[key] === 'function') {
                        middlewares.push(mod[key]);
                    }
                });

                // Só processa o primeiro arquivo de middleware encontrado na pasta
                break;
            } catch (e) {
                Console.error(`Error loading middleware ${fullPath}`, e);
            }
        }
    }

    middlewareCache.set(dir, middlewares);
    return middlewares;
}

export function loadBackendRoutes(backendRoutesDir: string) {
    if (!fs.existsSync(backendRoutesDir)) {
        allBackendRoutes = [];
        return;
    }

    middlewareCache.clear(); // Limpa cache de middleware ao recarregar rotas
    const loaded: CompiledBackendRoute[] = [];

    const scanAndLoadAPI = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        // Primeiro carrega middleware deste diretório para cachear
        getMiddlewaresForDir(dir);

        for (const entry of entries) {
            const name = entry.name;
            if (name.startsWith('.') || name.startsWith('_')) continue;

            const fullPath = path.join(dir, name);

            if (entry.isDirectory()) {
                scanAndLoadAPI(fullPath);
            } else if (entry.isFile() && (name.endsWith('.ts') || name.endsWith(".js"))) {
                if (name.startsWith('middleware')) continue;

                try {
                    const absolutePath = path.resolve(fullPath);
                    if (loadedFiles.has(absolutePath)) {
                        safeClearCache(absolutePath);
                    }

                    const mod = require(fullPath);
                    loadedFiles.add(absolutePath);

                    const config = mod.default;

                    if (config?.pattern) {
                        // Aplica middleware automaticamente se não definido
                        if (!config.middleware) {
                            const dirMiddlewares = getMiddlewaresForDir(dir);
                            if (dirMiddlewares.length > 0) {
                                config.middleware = dirMiddlewares;
                            }
                        }

                        // OTIMIZAÇÃO: Pré-compila regex
                        loaded.push({
                            config,
                            regex: compileRoutePatternWithGroups(config.pattern),
                            paramNames: []
                        });
                    }
                } catch (e) {
                    Console.error(`Error loading API route ${fullPath}`, e);
                }
            }
        }
    };

    scanAndLoadAPI(backendRoutesDir);
    allBackendRoutes = loaded;

    // Processa WebSockets após carregar rotas HTTP
    processWebSocketRoutes();
}

export function findMatchingBackendRoute(pathname: string, method: string) {
    const methodUpper = method.toUpperCase();

    for (const route of allBackendRoutes) {
        // @ts-ignore
        if (!route.config[methodUpper]) continue;

        const match = pathname.match(route.regex);
        if (match) {
            return {
                route: route.config,
                params: match.groups || {}
            };
        }
    }
    return null;
}


// --- 404 Not Found ---

export function loadNotFound(webDir: string): { componentPath: string } | null {
    const files = ['notFound.tsx', 'notFound.jsx', 'notFound.vue'];

    for (const file of files) {
        const fullPath = path.join(webDir, file);
        if (fs.existsSync(fullPath)) {
            const absolutePath = path.resolve(fullPath);
            const componentPath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');

            if (loadedFiles.has(absolutePath)) {
                safeClearCache(absolutePath);
            }

            // Também usa requireWithoutStyles para o 404
            requireWithoutStyles(absolutePath);

            loadedFiles.add(absolutePath);

            notFoundComponent = { componentPath };
            return notFoundComponent;
        }
    }

    notFoundComponent = null;
    return null;
}

export function getNotFound() { return notFoundComponent; }


// --- WebSocket (Mantendo lógica, otimizando lookup) ---

export function processWebSocketRoutes() {
    allWebSocketRoutes = allBackendRoutes
        .filter(r => r.config.WS)
        .map(r => ({
            config: r.config,
            regex: r.regex, // Reusa a regex já compilada da rota HTTP!
            handler: r.config.WS!,
            middleware: r.config.middleware
        }));
}

export function findMatchingWebSocketRoute(pathname: string) {
    for (const wsRoute of allWebSocketRoutes) {
        const match = pathname.match(wsRoute.regex);
        if (match) {
            return {
                route: {
                    pattern: wsRoute.config.pattern,
                    handler: wsRoute.handler,
                    middleware: wsRoute.middleware
                },
                params: match.groups || {}
            };
        }
    }
    return null;
}

function handleWebSocketConnection(ws: WebSocket, req: IncomingMessage, hwebReq: VattsRequest) {
    if (!req.url) return;
    const url = new URL(req.url, `http://${req.headers.host}`);

    const match = findMatchingWebSocketRoute(url.pathname);
    if (!match) {
        ws.close(1000, 'Route not found');
        return;
    }

    const context: WebSocketContext = {
        vattsReq: hwebReq,
        ws,
        req,
        url,
        params: match.params,
        query: Object.fromEntries(url.searchParams.entries()),
        send: (data: any) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(typeof data === 'string' ? data : JSON.stringify(data));
            }
        },
        close: (code, reason) => ws.close(code || 1000, reason),
        broadcast: (data, exclude) => {
            const msg = typeof data === 'string' ? data : JSON.stringify(data);
            const excludeSet = new Set(exclude || []);
            for (const conn of wsConnections) {
                if (conn.readyState === WebSocket.OPEN && !excludeSet.has(conn)) {
                    conn.send(msg);
                }
            }
        }
    };

    try {
        match.route.handler(context);
    } catch (error) {
        console.error('Error in WebSocket handler:', error);
        ws.close(1011, 'Internal server error');
    }
}

export function setupWebSocketUpgrade(server: any, hotReloadManager?: any) {
    if (server.listeners('upgrade').length > 0) return;

    server.on('upgrade', (request: any, socket: any, head: Buffer) => {
        const adapter = FrameworkAdapterFactory.getCurrentAdapter();
        if (!adapter) {
            socket.destroy();
            return;
        }

        const { pathname } = new URL(request.url, `http://${request.headers.host}`);

        // Prioridade 1: Hot Reload
        if (pathname === '/hweb-hotreload/') {
            if (hotReloadManager) hotReloadManager.handleUpgrade(request, socket, head);
            else socket.destroy();
            return;
        }

        // Prioridade 2: Rotas App
        const match = findMatchingWebSocketRoute(pathname);
        if (match) {
            const wss = new WSServer({ noServer: true, perMessageDeflate: false, maxPayload: 1024 * 1024 });

            wss.handleUpgrade(request, socket, head, (ws) => {
                wsConnections.add(ws);
                ws.on('close', () => wsConnections.delete(ws));
                ws.on('error', () => wsConnections.delete(ws));

                const hwebReq = new VattsRequest(adapter.parseRequest(request));
                handleWebSocketConnection(ws, request, hwebReq);
            });
            return;
        }

        socket.destroy();
    });
}