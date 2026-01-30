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
import { WebSocket, WebSocketServer } from 'ws';
import * as chokidar from 'chokidar';
import * as path from 'path';
import * as fs from 'fs';
import ts from 'typescript';
import { IncomingMessage } from 'http';
import { clearFileCache } from './router';
import Console, {Colors, Levels} from "./api/console"

// Chaves para persistência global para sobreviver a reloads do backend
const GLOBAL_ERROR_KEY = '__VATTS_LAST_BUILD_ERROR__';
const GLOBAL_ACTIVE_MANAGER_KEY = '__VATTS_ACTIVE_HOT_RELOAD_MANAGER__';

interface ClientConnection {
    ws: WebSocket;
    pingTimer: NodeJS.Timeout;
    lastPong: number;
}

// Interface para o estado composto de erro
interface BuildState {
    frontend: any | null;
    backend: any | null;
}

export class HotReloadManager {
    private wss: WebSocketServer | null = null;
    private watchers: chokidar.FSWatcher[] = [];
    private projectDir: string;
    private clients: Map<WebSocket, ClientConnection> = new Map();
    private backendApiChangeCallback: (() => void) | null = null;
    private frontendChangeCallback: (() => void) | null = null;
    private isShuttingDown: boolean = false;
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
    private customHotReloadListener: ((file: string) => Promise<void> | void) | null = null;
    private isBuilding: boolean = false;
    private buildCompleteResolve: (() => void) | null = null;

    // Impede que um "success" fora de ordem limpe um erro real de frontend.
    private lastFrontendErrorBuildId: number = 0;

    // Getter/Setter para acessar o erro persistente no escopo Global
    // Agora armazena um objeto { frontend: ..., backend: ... }
    private get buildState(): BuildState {
        const state = (global as any)[GLOBAL_ERROR_KEY];
        if (!state) {
            return { frontend: null, backend: null };
        }
        return state;
    }

    private set buildState(value: BuildState) {
        (global as any)[GLOBAL_ERROR_KEY] = value;
    }

    constructor(projectDir: string) {
        this.projectDir = projectDir;

        // Registra esta instância como a ativa globalmente
        (global as any)[GLOBAL_ACTIVE_MANAGER_KEY] = this;

        // Inicializa estado se vazio
        if (!(global as any)[GLOBAL_ERROR_KEY]) {
            this.buildState = { frontend: null, backend: null };
        }
    }

    async start() {
        this.setupWatchers();
    }

    handleUpgrade(request: IncomingMessage, socket: any, head: Buffer) {
        if (this.isShuttingDown) {
            socket.destroy();
            return;
        }

        if (!this.wss) {
            this.wss = new WebSocketServer({
                noServer: true,
                perMessageDeflate: false,
                maxPayload: 1024 * 1024
            });
            this.setupWebSocketServer();
        }

        this.wss.handleUpgrade(request, socket, head, (ws) => {
            this.wss!.emit('connection', ws, request);
        });
    }

    private setupWebSocketServer() {
        if (!this.wss) return;

        this.wss.on('connection', (ws: WebSocket) => {
            if (this.isShuttingDown) {
                ws.close();
                return;
            }

            const pingTimer = setInterval(() => {
                const client = this.clients.get(ws);
                if (client && ws.readyState === WebSocket.OPEN) {
                    if (Date.now() - client.lastPong > 60000) {
                        ws.terminate();
                        return;
                    }
                    ws.ping();
                }
            }, 30000);

            const clientConnection: ClientConnection = {
                ws,
                pingTimer,
                lastPong: Date.now()
            };

            this.clients.set(ws, clientConnection);

            // Ao conectar, envia o status atual combinado
            setTimeout(() => {
                if (ws.readyState !== WebSocket.OPEN) return;
                this.broadcastCurrentState(ws);
            }, 0);

            ws.on('message', (raw) => {
                try {
                    const msg = JSON.parse(String(raw || ''));
                    if (msg?.type === 'status-request') {
                        this.broadcastCurrentState(ws);
                    }
                } catch {
                    // ignore
                }
            });

            ws.on('pong', () => {
                const client = this.clients.get(ws);
                if (client) {
                    client.lastPong = Date.now();
                }
            });

            ws.on('close', () => {
                this.cleanupClient(ws);
            });

            ws.on('error', (error) => {
                Console.logWithout(Levels.ERROR, Colors.BgRed,`WebSocket error: ${error.message}`);
                this.cleanupClient(ws);
            });
        });
    }

    // Helper para enviar o estado correto (Erro se Tiver Frontend OU Backend error)
    private broadcastCurrentState(ws: WebSocket) {
        const state = this.buildState;
        const activeError = state.backend || state.frontend;

        if (activeError) {
            try {
                ws.send(JSON.stringify({ type: 'build-error', data: activeError, timestamp: Date.now() }));
            } catch {}
        } else {
            try {
                ws.send(JSON.stringify({ type: 'build-complete', data: { success: true }, timestamp: Date.now() }));
            } catch {}
        }
    }

    private cleanupClient(ws: WebSocket) {
        const client = this.clients.get(ws);
        if (client) {
            clearInterval(client.pingTimer);
            this.clients.delete(ws);
        }
    }

    private setupWatchers() {
        const debouncedChange = this.debounce((filePath: string) => {
            this.handleAnySrcChange(filePath);
        }, 100);

        const watcher = chokidar.watch([
            path.join(this.projectDir, 'src/**/*'),
        ], {
            ignored: [
                /(^|[\/\\])\../,
                '**/node_modules/**',
                '**/.git/**',
                '**/dist/**'
            ],
            persistent: true,
            ignoreInitial: true,
            usePolling: false,
            awaitWriteFinish: {
                stabilityThreshold: 100,
                pollInterval: 50
            }
        });

        watcher.on('change', debouncedChange);
        watcher.on('add', debouncedChange);
        watcher.on('unlink', (filePath) => {
            Console.info(`File removed: ${path.basename(filePath)}`);
            clearFileCache(filePath);
            this.clearBackendCache(filePath);

            // Unlink também precisa de try-catch se for chamar callbacks
            try { this.frontendChangeCallback?.(); } catch(e) { this.setBackendError(e); }
            try { this.backendApiChangeCallback?.(); } catch(e) { this.setBackendError(e); }

            this.notifyClients('src-reload', { file: filePath, event: 'unlink' });
        });

        this.watchers.push(watcher);
    }

    private debounce(func: Function, wait: number): (...args: any[]) => void {
        return (...args: any[]) => {
            const key = args[0];
            const existingTimer = this.debounceTimers.get(key);
            if (existingTimer) clearTimeout(existingTimer);
            const timer = setTimeout(() => {
                this.debounceTimers.delete(key);
                func.apply(this, args);
            }, wait);
            this.debounceTimers.set(key, timer);
        };
    }

    // Método para capturar erro do Backend explicitamente
    private setBackendError(error: any) {
        const currentState = this.buildState;

        // Formata o erro para ser amigável ao JSON
        const errorData = {
            message: error?.message || 'Unknown Backend Error',
            stack: error?.stack,
            type: 'BackendError',
            ts: Date.now()
        };

        // Se for erro de TypeScript/ts-node compilando TSX, trata como erro de FRONT também
        // (é a mesma causa raiz que impede o app de rodar).
        const isTypeScriptCompileError =
            typeof errorData.message === 'string' &&
            (errorData.message.includes('Unable to compile TypeScript') ||
                errorData.message.includes('TSError') ||
                errorData.message.includes('TS2304') ||
                errorData.message.includes('TS1005') ||
                errorData.message.includes('TS17002'));

        Console.error("Captured Backend Error:", errorData.message);

        this.buildState = {
            ...currentState,
            backend: errorData,
            frontend: isTypeScriptCompileError ? (currentState.frontend || errorData) : currentState.frontend
        };

        // Notifica clientes imediatamente
        this.notifyStatusChange();
    }

    private async handleAnySrcChange(filePath: string) {
        const dm = Console.dynamicLine(`File change detected ${path.basename(filePath)}, processing...`);
        let hasBackendError = false;

        const isFrontendFile = filePath.includes(path.join('src', 'web', 'routes')) ||
            filePath.includes(path.join('src', 'web', 'components')) ||
            filePath.includes('layout.tsx') ||
            filePath.includes('not-found.tsx') ||
            filePath.endsWith('.tsx') ||
            filePath.endsWith(".ts") ||
            filePath.endsWith(".vue") ||
            filePath.endsWith(".css")

        const isBackendFile = filePath.includes(path.join('src', 'backend')) && !isFrontendFile;

        clearFileCache(filePath);
        this.clearBackendCache(filePath);

        // Tenta executar os callbacks e captura erros do Backend (Router/SSR)
        try {
            if (isFrontendFile) {
                Console.logWithout(Levels.INFO, undefined, `Frontend change detected: ${path.basename(filePath)}`);

                // CRÍTICO: Executa e captura erro
                try {
                    this.frontendChangeCallback?.();
                    // Se passou aqui, limpa erro de backend anterior
                    const s = this.buildState;
                    if (s.backend) {
                        this.buildState = { ...s, backend: null };
                        this.notifyStatusChange();
                    }
                } catch (e) {
                    this.setBackendError(e);
                    hasBackendError = true;
                }

                dm.end(`Frontend change detected for ${path.basename(filePath)}, notifying clients.`);
                this.notifyClients('frontend-reload', { file: filePath, event: 'change' });
            }
            else if (isBackendFile) {
                Console.logWithout(Levels.INFO, undefined, `Backend change detected: ${path.basename(filePath)}. Reloading backend...`);

                try {
                    this.backendApiChangeCallback?.();
                    // Se passou aqui, limpa erro de backend anterior
                    const s = this.buildState;
                    if (s.backend) {
                        this.buildState = { ...s, backend: null };
                        this.notifyStatusChange();
                    }
                } catch (e) {
                    this.setBackendError(e);
                    hasBackendError = true;
                }

                this.notifyClients('backend-api-reload', { file: filePath, event: 'change' });
                dm.end(`Backend reloaded for ${path.basename(filePath)}.`);
            }
            else {
                // Fallback
                try { this.frontendChangeCallback?.(); } catch(e) { this.setBackendError(e); hasBackendError = true; }
                try { this.backendApiChangeCallback?.(); } catch(e) { if(!hasBackendError) this.setBackendError(e); hasBackendError = true; }

                this.notifyClients('src-reload', { file: filePath, event: 'change' });
                dm.end(`Application reload triggered by ${path.basename(filePath)}.`);
            }
        } catch (e) {
            // Catch-all de segurança
            this.setBackendError(e);
        }

        if (this.customHotReloadListener) {
            try {
                await this.customHotReloadListener(filePath);
            } catch (error) {
                // @ts-ignore
                Console.logWithout(Levels.ERROR, `Error in custom listener: ${error.message}`);
            }
        }
    }

    private notifyStatusChange() {
        const state = this.buildState;
        const activeError = state.backend || state.frontend; // Backend tem prioridade ou unificamos?

        if (activeError) {
            this.notifyClients('build-error', activeError);
        } else {
            this.notifyClients('build-complete', { success: true });
        }
    }

    private notifyClients(type: string, data?: any) {
        if (this.isShuttingDown) return;

        if (this.clients.size === 0) {
            const activeManager = (global as any)[GLOBAL_ACTIVE_MANAGER_KEY];
            if (activeManager && activeManager !== this) {
                // @ts-ignore
                activeManager.notifyClients(type, data);
                return;
            }
        }

        const message = JSON.stringify({ type, data, timestamp: Date.now() });
        const deadClients: WebSocket[] = [];

        this.clients.forEach((client, ws) => {
            if (ws.readyState === WebSocket.OPEN) {
                try {
                    ws.send(message);
                } catch (error) {
                    deadClients.push(ws);
                }
            } else {
                deadClients.push(ws);
            }
        });

        deadClients.forEach(ws => this.cleanupClient(ws));
    }

    // ... (rest of methods like getClientScript, clearBackendCache keep unchanged or minimally adjusted)

    // Script do cliente otimizado com reconnection backoff
    getClientScript(): string {
        return `
        <script>
        (function() {
            if (typeof window !== 'undefined') {
                let ws;
                let reconnectAttempts = 0;
                let maxReconnectInterval = 30000; 
                let reconnectInterval = 1000;
                let reconnectTimer;
                let isConnected = false;
                let lastBuildError = null;

                function emitBuildError(error) {
                    try {
                        lastBuildError = error;
                        // Não persistimos erro no client. Ele sempre vem do servidor via WebSocket.
                        window.dispatchEvent(new CustomEvent('vatts:build-error', { detail: error }));
                    } catch {}
                }

                function clearBuildError() {
                    try {
                        lastBuildError = null;
                        window.dispatchEvent(new CustomEvent('vatts:build-ok', { detail: { ts: Date.now() } }));
                    } catch {}
                }

                // Não faz bootstrap de erro salvo (sem sessionStorage/localStorage).

                function notifyHotReloadState(state, payload) {
                    try {
                        window.__VATTS_HOT_RELOAD__ = { state: state, payload: payload || null, ts: Date.now() };
                        const ev = new CustomEvent('vatts:hotreload', { detail: window.__VATTS_HOT_RELOAD__ });
                        window.dispatchEvent(ev);
                    } catch {}
                }

                function requestBuildStatus(reason) {
                    try {
                        if (!ws || ws.readyState !== WebSocket.OPEN) return;
                        ws.send(JSON.stringify({ type: 'status-request', reason: reason || 'unknown', ts: Date.now() }));
                    } catch {}
                }

                async function waitForMainToBeUpdated(timeoutMs, pollMs) {
                    try {
                        const script = document.querySelector('script[src*="main.js"]');
                        if (!script || !script.src) return true;
                        const mainUrl = script.src.split('?')[0];
                        const start = Date.now();
                        let baseline = '';
                        try {
                            const r0 = await fetch(mainUrl + '?t=' + Date.now(), { cache: 'no-store' });
                            baseline = await r0.text();
                        } catch { return true; }

                        while (Date.now() - start < timeoutMs) {
                            await new Promise(r => setTimeout(r, pollMs));
                            try {
                                const r = await fetch(mainUrl + '?t=' + Date.now(), { cache: 'no-store' });
                                const txt = await r.text();
                                if (txt && txt !== baseline) return true;
                            } catch {}
                        }
                        return false;
                    } catch { return true; }
                }
                
                function connect() {
                    const url = window.location;
                    const protocol = url.protocol === "https:" ? "wss:" : "ws:";
                    const wsUrl = protocol + '//' + url.host + '/hweb-hotreload/';
                    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;

                    try {
                        ws = new WebSocket(wsUrl);
                        ws.onopen = function() {
                            console.log('\u001b[32m[vatts]\u001b[0m Hot-reload connected');
                            isConnected = true;
                            reconnectAttempts = 0;
                            clearTimeout(reconnectTimer);
                            // Ao conectar, sempre pede o status atual ao servidor.
                            requestBuildStatus('ws-open');
                        };
                        
                        ws.onmessage = function(event) {
                            try {
                                const message = JSON.parse(event.data);
                                switch(message.type) {
                                    case 'frontend-reload':
                                        handleFrontendReload(message.data);
                                        break;
                                    case 'backend-api-reload':
                                        console.log('[vatts] Backend changed, reloading page...');
                                        window.location.reload();
                                        break;
                                    case 'server-restart':
                                        console.log('[vatts] Server restarting...');
                                        break;
                                    case 'server-ready':
                                        setTimeout(() => window.location.reload(), 500);
                                        break;
                                    case 'build-error':
                                        console.log('Erro detectado')
                                        notifyHotReloadState('build-error', message.data);
                                        emitBuildError(message.data);
                                        break;
                                    case 'build-complete':
                                        notifyHotReloadState('idle', { build: 'ok' });
                                        clearBuildError();
                                        console.log('[vatts] Build complete');
                                        break;
                                }
                            } catch (e) {
                                console.error('[vatts] Error processing msg:', e);
                            }
                        };
                        
                        async function handleFrontendReload(data) {
                            notifyHotReloadState('reloading', { type: 'frontend', data: data || null });
                            if (!data || !data.file) {
                                window.dispatchEvent(new CustomEvent('hmr:component-update', { detail: { file: null, timestamp: Date.now() } }));
                                return;
                            }
                            const file = (data.file || '').toLowerCase();
                            console.log('[vatts] Frontend changed:', data.file);
                            const needsFullReload = file.includes('layout.tsx') || file.includes('not-found.tsx') || file.endsWith('.css');
                            if (needsFullReload) {
                                notifyHotReloadState('full-reload', { reason: 'layout/css', file: data.file });
                                window.location.reload();
                                return;
                            }

                            // Recarrega main.js (o bundle do app) com cache-busting.
                            // Em DEV, React/ReactDOM agora são externos, então isso não duplica hooks.
                            await waitForMainToBeUpdated(5000, 120);

                            const script = document.querySelector('script[src*="main.js"]');
                            if (script) {
                                const mainUrl = (script.getAttribute('src') || script.src || '');
                                const base = String(mainUrl).split('?')[0];

                                // Remove scripts antigos de main.js para evitar múltiplas execuções do bundle
                                try {
                                    document.querySelectorAll('script[src*="main.js"]').forEach(s => {
                                        if (s && s.parentNode) s.parentNode.removeChild(s);
                                    });
                                } catch {}

                                const newScript = document.createElement('script');
                                newScript.type = 'module';
                                newScript.src = base + '?t=' + Date.now();

                                newScript.onload = () => {
                                    // depois de carregar o novo bundle, pede render/update
                                    const ts = Date.now();
                                    window.dispatchEvent(new CustomEvent('hmr:component-update', { detail: { file: data.file, timestamp: ts } }));
                                    setTimeout(() => requestBuildStatus('after-frontend-reload'), 50);
                                };

                                newScript.onerror = () => {
                                    window.location.reload();
                                };

                                document.head.appendChild(newScript);
                            } else {
                                // fallback
                                const ts = Date.now();
                                window.dispatchEvent(new CustomEvent('hmr:component-update', { detail: { file: data.file, timestamp: ts } }));
                                setTimeout(() => requestBuildStatus('after-frontend-reload'), 50);
                            }

                            setTimeout(() => {
                                if (window.__HMR_SUCCESS__) {
                                    notifyHotReloadState('idle', { success: true, file: data.file });
                                    requestBuildStatus('after-hmr-success');
                                    return;
                                }
                 
                                window.location.reload();
                            }, 1600);
                        }
                        
                        ws.onclose = function(event) {
                            isConnected = false;
                            if (event.code === 1000) return;
                            scheduleReconnect();
                        };
                        ws.onerror = function() {};
                    } catch (error) { scheduleReconnect(); }
                }
                
                function scheduleReconnect() {
                    if (reconnectTimer) clearTimeout(reconnectTimer);
                    reconnectAttempts++;
                    const baseInterval = Math.min(reconnectInterval * Math.pow(1.5, reconnectAttempts - 1), maxReconnectInterval);
                    reconnectTimer = setTimeout(() => { if (!isConnected) connect(); }, baseInterval + Math.random() * 1000);
                }
                
                window.addEventListener('beforeunload', function() { if (ws && ws.readyState === WebSocket.OPEN) ws.close(1000, 'Page unloading'); });
                document.addEventListener('visibilitychange', function() { if (!document.hidden && !isConnected) { reconnectAttempts = 0; connect(); } });
                connect();
            }
        })();
        </script>
        `;
    }

    // Mantendo métodos de cache iguais
    private clearBackendCache(filePath: string) {
        const absolutePath = path.resolve(filePath);
        // Limpa o arquivo alterado
        delete require.cache[absolutePath];

        // ESTRATÉGIA DE INVALIDAÇÃO PROFUNDA PARA TYPESCRIPT:
        // O problema de mudar tipagem e dar erro de runtime é porque arquivos "pais"
        // (que importam o arquivo alterado) ainda mantêm a referência compilada antiga na memória do Node.
        // Ao invés de tentar adivinhar a árvore de dependência, limpamos o cache de TODO o código-fonte do projeto.
        // Isso força o Node/ts-node a recompilar/reler as referências, atualizando as tipagens e objetos em tempo real.
        
        Object.keys(require.cache).forEach(key => {
            // Não limpa node_modules (bibliotecas são estáticas)
            if (key.includes('node_modules')) return;

            // Se o arquivo estiver dentro do diretório do projeto, força a limpeza.
            // Isso garante que controllers, services e models recarreguem a nova estrutura da tipagem alterada.
            if (key.startsWith(this.projectDir)) {
                delete require.cache[key];
            }
        });
    }

    onBackendApiChange(callback: () => void) { this.backendApiChangeCallback = callback; }
    onFrontendChange(callback: () => void) { this.frontendChangeCallback = callback; }
    setHotReloadListener(listener: (file: string) => Promise<void> | void) {
        this.customHotReloadListener = listener;
        Console.info('Hot reload custom listener registered');
    }
    removeHotReloadListener() { this.customHotReloadListener = null; }

    // DEBUG: stack traces (rate-limited) para descobrir quem dispara onBuildComplete
    private lastBuildCompleteTraceAt: number = 0;
    private traceBuildComplete(success: boolean, error?: any) {
        try {
            const now = Date.now();
            // Rate limit pra não floodar o console
            if (now - this.lastBuildCompleteTraceAt < 500) return;
            this.lastBuildCompleteTraceAt = now;
        } catch {
            // noop
        }
    }

    onBuildComplete(success: boolean, error?: any) {
        // DEBUG stack
        this.traceBuildComplete(success, error);

        const activeManager = (global as any)[GLOBAL_ACTIVE_MANAGER_KEY];
        if (activeManager && activeManager !== this) {
            activeManager.onBuildComplete(success, error);
            return;
        }

        if (this.buildCompleteResolve) {
            this.buildCompleteResolve();
            this.buildCompleteResolve = null;
        }
        this.isBuilding = false;

        const currentState = this.buildState;
        const buildId = typeof (error as any)?.buildId === 'number' ? (error as any).buildId : undefined;

        if (success) {
            // Não confia no bundler. Antes de ficar "verde", roda typecheck real (React + Vue).
            const tc = this.typecheckFrontend();
            if (!tc.ok) {
                // Se já existe um erro de bundler (esbuild/rollup) mais específico, preserva ele.
                // O typecheck serve como "gate" para não ficar verde, mas não deve piorar a mensagem.
                const existing = currentState.frontend;
                const shouldKeepExistingBundlerError =
                    existing &&
                    typeof existing?.message === 'string' &&
                    (existing.message.includes('Transform failed') || existing.message.includes('Expected') || existing.message.includes('esbuild'));

                this.buildState = {
                    ...currentState,
                    frontend: shouldKeepExistingBundlerError ? existing : (tc.error ?? existing)
                };
                this.notifyStatusChange();
                return;
            }

            // Proteção: não deixa um success antigo limpar um erro mais novo
            if (buildId !== undefined && buildId < this.lastFrontendErrorBuildId) {
                this.buildState = { ...currentState };
                this.notifyStatusChange();
                return;
            }

            this.buildState = { ...currentState, frontend: null, backend: null };
            this.notifyStatusChange();
            return;
        }

        // error
        const errData = error || { message: 'Build failed', ts: Date.now() };
        if (buildId !== undefined) this.lastFrontendErrorBuildId = Math.max(this.lastFrontendErrorBuildId, buildId);
        this.buildState = { ...currentState, frontend: errData };

        // Notifica baseado no estado combinado (Frontend + Backend)
        this.notifyStatusChange();
    }

    stop() {
        this.isShuttingDown = true;
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
        this.watchers.forEach(watcher => watcher.close());
        this.watchers = [];
        this.clients.forEach((client, ws) => {
            clearInterval(client.pingTimer);
            if (ws.readyState === WebSocket.OPEN) ws.close();
        });
        this.clients.clear();
        if (this.wss) {
            this.wss.close();
            this.wss = null;
        }
    }

    private lastTypecheckAt = 0;
    private lastTypecheckResult: { ok: boolean; error?: any } | null = null;

    /**
     * Verifica erros específicos de arquivos Vue usando @vue/compiler-sfc.
     * Isso permite capturar erros de sintaxe (como falta de ponto e vírgula, tags mal fechadas)
     * que o compilador padrão pode emitir mas que precisam ser formatados para o cliente.
     */
    private checkVueFiles(): { ok: boolean; error?: any } | null {
        try {
            // 1. Tenta carregar o compilador do Vue dinamicamente
            let compiler: any;
            try {
                compiler = require('vue/compiler-sfc');
            } catch {
                try {
                    compiler = require('@vue/compiler-sfc');
                } catch {
                    // Não é um projeto Vue ou dependência faltando, apenas ignora
                    return null;
                }
            }

            // 2. Scan síncrono para encontrar arquivos .vue em src/web
            // Em projetos gigantes isso deve ser otimizado, mas para dev server é ok.
            const findVueFiles = (dir: string): string[] => {
                let results: string[] = [];
                if (!fs.existsSync(dir)) return results;
                const list = fs.readdirSync(dir);
                list.forEach(file => {
                    const filePath = path.join(dir, file);
                    const stat = fs.statSync(filePath);
                    if (stat && stat.isDirectory()) {
                        if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
                            results = results.concat(findVueFiles(filePath));
                        }
                    } else if (file.endsWith('.vue')) {
                        results.push(filePath);
                    }
                });
                return results;
            };

            const webSrc = path.join(this.projectDir, 'src');
            const vueFiles = findVueFiles(webSrc);

            if (vueFiles.length === 0) return { ok: true };

            // 3. Analisa cada arquivo Vue
            for (const file of vueFiles) {
                try {
                    const content = fs.readFileSync(file, 'utf-8');
                    const parsed = compiler.parse(content, {
                        filename: file,
                        sourceMap: false
                    });

                    // Verifica erros de compilação do template/script
                    if (parsed.errors && parsed.errors.length > 0) {
                        const firstError = parsed.errors[0];
                        const loc = firstError.loc ? {
                            file: file,
                            line: firstError.loc.start.line,
                            column: firstError.loc.start.column
                        } : undefined;

                        // Stack simulada para o overlay exibir bonito
                        const syntheticStack = `SyntaxError: ${firstError.message}\n    at ${file}:${loc?.line}:${loc?.column}`;

                        return {
                            ok: false,
                            error: {
                                message: `Vue Error: ${firstError.message}`,
                                type: 'VueCompilerError',
                                loc,
                                stack: syntheticStack,
                                ts: Date.now()
                            }
                        };
                    }
                } catch (readError) {
                    // Ignora erro de leitura de arquivo individual
                }
            }
        } catch (e) {
            // Ignora falha geral no checker do Vue
        }
        return { ok: true };
    }

    private typecheckFrontend(): { ok: boolean; error?: any } {
        try {
            const now = Date.now();
            if (this.lastTypecheckResult && now - this.lastTypecheckAt < 750) return this.lastTypecheckResult;

            // --- 1. Vue Check (New) ---
            // Verifica arquivos Vue primeiro, pois o TS compiler padrão pode ignorá-los
            // ou dar erros confusos se não estiver configurado com plugins.
            const vueResult = this.checkVueFiles();
            if (vueResult && !vueResult.ok) {
                this.lastTypecheckAt = now;
                this.lastTypecheckResult = vueResult;
                return vueResult;
            }

            // --- 2. TypeScript Check (Existing) ---
            const projectDir = this.projectDir;
            const configPath = ts.findConfigFile(projectDir, ts.sys.fileExists, 'tsconfig.json');
            if (!configPath) {
                this.lastTypecheckAt = now;
                this.lastTypecheckResult = { ok: true };
                return this.lastTypecheckResult;
            }

            const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
            if (configFile.error) {
                const msg = ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n');
                const err = { message: `tsconfig read error: ${msg}`, type: 'TypeScriptConfigError', ts: Date.now() };
                this.lastTypecheckAt = now;
                this.lastTypecheckResult = { ok: false, error: err };
                return this.lastTypecheckResult;
            }

            const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath));
            const options: ts.CompilerOptions = { ...parsed.options, noEmit: true };

            const rootNames = parsed.fileNames;
            const webRoot = path.resolve(projectDir, 'src', 'web') + path.sep;
            // Filtra apenas arquivos dentro de src/web para não checar backend aqui
            const filteredRoots = rootNames.filter(f => f.startsWith(webRoot));

            // Se for um projeto Vue puro sem .ts/.tsx explícito na config, o createProgram pode ficar vazio,
            // então usamos os rootNames originais se o filtro zerar tudo.
            const filesToCheck = filteredRoots.length ? filteredRoots : rootNames;

            if (filesToCheck.length === 0) {
                this.lastTypecheckAt = now;
                this.lastTypecheckResult = { ok: true };
                return this.lastTypecheckResult;
            }

            const program = ts.createProgram(filesToCheck, options);
            const diagnostics = ts.getPreEmitDiagnostics(program);

            if (!diagnostics.length) {
                this.lastTypecheckAt = now;
                this.lastTypecheckResult = { ok: true };
                return this.lastTypecheckResult;
            }

            const first = diagnostics[0];
            const message = ts.flattenDiagnosticMessageText(first.messageText, '\n');
            const code = typeof first.code === 'number' ? `TS${first.code}` : undefined;

            const loc = first.file && typeof first.start === 'number'
                ? (() => {
                    const pos = first.file!.getLineAndCharacterOfPosition(first.start!);
                    return { file: first.file!.fileName, line: pos.line + 1, column: pos.character + 1 };
                })()
                : undefined;

            const lines: string[] = [];
            lines.push(`TypeScript check failed${code ? ` (${code})` : ''}: ${message}`);
            if (loc?.file) lines.push(`at ${loc.file}:${loc.line}:${loc.column}`);

            // stack sintético só pra debug (sem poluir com stack interna do TS)
            const syntheticStack = ['Error: ' + lines[0], ...(loc?.file ? [lines[1]] : [])].join('\n');

            const err = {
                message: lines[0],
                type: 'TypeScriptError',
                code,
                loc,
                // compat: alguns overlays procuram stack
                stack: syntheticStack,
                ts: Date.now()
            };

            this.lastTypecheckAt = now;
            this.lastTypecheckResult = { ok: false, error: err };
            return this.lastTypecheckResult;
        } catch (e: any) {
            const err = { message: e?.message || 'TypeScript check failed', stack: e?.stack, type: 'TypeScriptError', ts: Date.now() };
            this.lastTypecheckAt = Date.now();
            this.lastTypecheckResult = { ok: false, error: err };
            return this.lastTypecheckResult;
        }
    }
}