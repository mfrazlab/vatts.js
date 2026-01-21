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
import { WebSocket, WebSocketServer } from 'ws';
import * as chokidar from 'chokidar';
import * as path from 'path';
import * as fs from 'fs';
import { IncomingMessage } from 'http';
import * as url from 'url';
import { clearFileCache } from './router';
import Console, {Colors, Levels} from "./api/console"

interface ClientConnection {
    ws: WebSocket;
    pingTimer: NodeJS.Timeout;
    lastPong: number;
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
    private lastBuildError: any | null = null;

    constructor(projectDir: string) {
        this.projectDir = projectDir;
    }

    async start() {
        this.setupWatchers();
    }

    // Método para integrar com Express
    handleUpgrade(request: IncomingMessage, socket: any, head: Buffer) {
        if (this.isShuttingDown) {
            socket.destroy();
            return;
        }

        if (!this.wss) {
            this.wss = new WebSocketServer({
                noServer: true,
                perMessageDeflate: false, // Desabilita compressão para melhor performance
                maxPayload: 1024 * 1024 // Limite de 1MB por mensagem
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

            // Setup ping/pong para detectar conexões mortas
            const pingTimer = setInterval(() => {
                const client = this.clients.get(ws);
                if (client && ws.readyState === WebSocket.OPEN) {
                    // Se não recebeu pong há mais de 60 segundos, desconecta
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

            // Ao conectar, envia o status atual (especialmente último erro de build),
            // mas faz isso no próximo tick pra evitar corrida do handshake.
            setTimeout(() => {
                if (ws.readyState !== WebSocket.OPEN) return;
                if (this.lastBuildError) {
                    try {
                        ws.send(JSON.stringify({ type: 'build-error', data: this.lastBuildError, timestamp: Date.now() }));
                    } catch {
                        // ignore
                    }
                } else {
                    try {
                        ws.send(JSON.stringify({ type: 'build-complete', data: { success: true }, timestamp: Date.now() }));
                    } catch {
                        // ignore
                    }
                }
            }, 0);

            ws.on('message', (raw) => {
                try {
                    const msg = JSON.parse(String(raw || ''));
                    if (msg?.type === 'status-request') {
                        // responde com o estado atual
                        if (this.lastBuildError) {
                            ws.send(JSON.stringify({ type: 'build-error', data: this.lastBuildError, timestamp: Date.now() }));
                        } else {
                            ws.send(JSON.stringify({ type: 'build-complete', data: { success: true }, timestamp: Date.now() }));
                        }
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

    private cleanupClient(ws: WebSocket) {
        const client = this.clients.get(ws);
        if (client) {
            clearInterval(client.pingTimer);
            this.clients.delete(ws);
        }
    }

    private setupWatchers() {
        // Remove watchers antigos e use apenas um watcher global para src
        const debouncedChange = this.debounce((filePath: string) => {
            this.handleAnySrcChange(filePath);
        }, 100);

        const watcher = chokidar.watch([
            path.join(this.projectDir, 'src/**/*'),
        ], {
            ignored: [
                /(^|[\/\\])\../, // arquivos ocultos
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
            Console.info(`🗑️ Arquivo removido: ${path.basename(filePath)}`);
            clearFileCache(filePath);
            this.clearBackendCache(filePath);
            this.frontendChangeCallback?.();
            this.backendApiChangeCallback?.();
            this.notifyClients('src-reload', { file: filePath, event: 'unlink' });
        });

        this.watchers.push(watcher);
    }

    private debounce(func: Function, wait: number): (...args: any[]) => void {
        return (...args: any[]) => {
            const key = args[0]; // usa o primeiro argumento como chave

            const existingTimer = this.debounceTimers.get(key);
            if (existingTimer) {
                clearTimeout(existingTimer);
            }

            const timer = setTimeout(() => {
                this.debounceTimers.delete(key);
                func.apply(this, args);
            }, wait);

            this.debounceTimers.set(key, timer);
        };
    }

    private async handleAnySrcChange(filePath: string) {
        const dm = Console.dynamicLine(`File change detected ${path.basename(filePath)}, processing...`);

        // Detecta se é arquivo de frontend ou backend
        const isFrontendFile = filePath.includes(path.join('src', 'web', 'routes')) ||
            filePath.includes(path.join('src', 'web', 'components')) ||
            filePath.includes('layout.tsx') ||
            filePath.includes('not-found.tsx') ||
            filePath.endsWith('.tsx');

        const isBackendFile = filePath.includes(path.join('src', 'backend')) && !isFrontendFile;

        // Limpa o cache do arquivo alterado
        clearFileCache(filePath);
        this.clearBackendCache(filePath);

        // Se for arquivo de frontend, NÃO aguarda build. Apenas avisa o frontend para tentar um soft reload.
        // Em modo dev com Vite, o bundler já recompila/serve as mudanças.
        if (isFrontendFile) {
            Console.logWithout(Levels.INFO, undefined, `Frontend change detected: ${path.basename(filePath)}`);

            // Mantém a regeneração do entry file/rotas no backend (necessário para novas rotas/layout/not-found)
            this.frontendChangeCallback?.();

            dm.end(`Frontend change detected for ${path.basename(filePath)}, notifying clients.`);

            // O client tenta HMR/soft-reload (sem recarregar a página inteira)
            this.notifyClients('frontend-reload', { file: filePath, event: 'change' });
            return;
        }

        // Se for arquivo de backend, recarrega o módulo e notifica
        if (isBackendFile) {
            Console.logWithout(Levels.INFO, undefined, `Backend change detected: ${path.basename(filePath)}. Reloading backend...`);
            this.backendApiChangeCallback?.();
            this.notifyClients('backend-api-reload', { file: filePath, event: 'change' });
            dm.end(`Backend reloaded for ${path.basename(filePath)}.`);
            return;
        }

        // Fallback: se não for nem frontend nem backend detectado, recarrega tudo
        Console.logWithout(Levels.INFO, undefined, `File change detected (misc): ${path.basename(filePath)}. Reloading application...`);
        this.frontendChangeCallback?.();
        this.backendApiChangeCallback?.();
        this.notifyClients('src-reload', { file: filePath, event: 'change' });
        dm.end(`Application reload triggered by ${path.basename(filePath)}.`);

        // Chama listener customizado se definido
        if (this.customHotReloadListener) {
            try {
                await this.customHotReloadListener(filePath);
            } catch (error) {
                // @ts-ignore
                Console.logWithout(Levels.ERROR, `Error in custom listener: ${error.message}`);
            }
        }
    }

    private notifyClients(type: string, data?: any) {
        if (this.isShuttingDown || this.clients.size === 0) {
            return;
        }

        const message = JSON.stringify({ type, data, timestamp: Date.now() });
        const deadClients: WebSocket[] = [];

        this.clients.forEach((client, ws) => {
            if (ws.readyState === WebSocket.OPEN) {
                try {
                    ws.send(message);
                } catch (error) {
                    Console.logWithout(Levels.ERROR, Colors.BgRed, `Error sending WebSocket message: ${error}`);
                    deadClients.push(ws);
                }
            } else {
                deadClients.push(ws);
            }
        });

        // Remove clientes mortos
        deadClients.forEach(ws => this.cleanupClient(ws));
    }

    private restartServer() {
        this.notifyClients('server-restart');
        setTimeout(() => {
            this.notifyClients('server-ready');
        }, 2000);
    }

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

                // Estado de erro de build (o app pode usar para UI)
                let lastBuildError = null;

                function emitBuildError(error) {
                    try {
                        lastBuildError = error;
                        window.__VATTS_BUILD_ERROR__ = error;
                        try {
                            sessionStorage.setItem('__VATTS_BUILD_ERROR__', JSON.stringify(error));
                        } catch {}

                        window.dispatchEvent(new CustomEvent('vatts:build-error', { detail: error }));
                    } catch {
                        // noop
                    }
                }

                function clearBuildError() {
                    try {
                        lastBuildError = null;
                        window.__VATTS_BUILD_ERROR__ = null;
                        try {
                            sessionStorage.removeItem('__VATTS_BUILD_ERROR__');
                        } catch {}

                        window.dispatchEvent(new CustomEvent('vatts:build-ok', { detail: { ts: Date.now() } }));
                    } catch {
                        // noop
                    }
                }

                // Se a página recarregou e já existe erro salvo, re-dispara o evento
                // para garantir que o React pegue (mesmo se o WS ainda não mandou).
                (function bootstrapStoredBuildError() {
                    try {
                        const existing = window.__VATTS_BUILD_ERROR__;
                        if (existing) {
                            setTimeout(() => {
                                try { window.dispatchEvent(new CustomEvent('vatts:build-error', { detail: existing })); } catch {}
                            }, 0);
                            return;
                        }

                        const fromStorage = sessionStorage.getItem('__VATTS_BUILD_ERROR__');
                        if (fromStorage) {
                            const parsed = JSON.parse(fromStorage);
                            window.__VATTS_BUILD_ERROR__ = parsed;
                            setTimeout(() => {
                                try { window.dispatchEvent(new CustomEvent('vatts:build-error', { detail: parsed })); } catch {}
                            }, 0);
                        }
                    } catch {
                        // ignore
                    }
                })();

                function notifyHotReloadState(state, payload) {
                    try {
                        // estado global simples pra debug/telemetria local
                        window.__VATTS_HOT_RELOAD__ = { state: state, payload: payload || null, ts: Date.now() };
                        const ev = new CustomEvent('vatts:hotreload', { detail: window.__VATTS_HOT_RELOAD__ });
                        window.dispatchEvent(ev);
                    } catch {
                        // noop
                    }
                }

                function requestBuildStatus(reason) {
                    try {
                        if (!ws || ws.readyState !== WebSocket.OPEN) return;
                        ws.send(JSON.stringify({ type: 'status-request', reason: reason || 'unknown', ts: Date.now() }));
                    } catch {
                        // ignore
                    }
                }

                // Aguarda o main.js ficar "atual" antes de disparar o soft reload.
                // Isso evita o problema de o evento chegar antes do bundler (Vite/dev server) terminar de servir o novo conteúdo.
                async function waitForMainToBeUpdated(timeoutMs, pollMs) {
                    try {
                        const script = document.querySelector('script[src*="main.js"]');
                        if (!script || !script.src) return true; // se não achou, não bloqueia

                        const mainUrl = script.src.split('?')[0];
                        const start = Date.now();

                        // conteúdo atual (baseline)
                        let baseline = '';
                        try {
                            const r0 = await fetch(mainUrl + '?t=' + Date.now(), { cache: 'no-store' });
                            baseline = await r0.text();
                        } catch {
                            // se falhar o fetch baseline, segue sem bloquear
                            return true;
                        }

                        while (Date.now() - start < timeoutMs) {
                            await new Promise(r => setTimeout(r, pollMs));
                            try {
                                const r = await fetch(mainUrl + '?t=' + Date.now(), { cache: 'no-store' });
                                const txt = await r.text();
                                if (txt && txt !== baseline) {
                                    return true;
                                }
                            } catch {
                                // ignora e continua tentando
                            }
                        }

                        // timeout: deixa o app seguir e usar fallback (reload) se precisar
                        return false;
                    } catch {
                        return true;
                    }
                }
                
                function connect() {
                    const url = window.location; // Objeto com info da URL atual
                    const protocol = url.protocol === "https:" ? "wss:" : "ws:"; // Usa wss se for https
                    const wsUrl = protocol + '//' + url.host + '/hweb-hotreload/';
                    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
                        return;
                    }

                    try {
                        ws = new WebSocket(wsUrl);
                        
                        ws.onopen = function() {
                            console.log('\u001b[32m[vatts]\u001b[0m Hot-reload connected');
                            isConnected = true;
                            reconnectAttempts = 0;
                            reconnectInterval = 1000;
                            clearTimeout(reconnectTimer);

                            // Pede o status atual (erro de build / ok) sempre que reconectar.
                            requestBuildStatus('ws-open');

                            // Também tenta sincronizar UI com algum erro já persistido
                            try {
                                if (window.__VATTS_BUILD_ERROR__) {
                                    setTimeout(() => {
                                        try { window.dispatchEvent(new CustomEvent('vatts:build-error', { detail: window.__VATTS_BUILD_ERROR__ })); } catch {}
                                    }, 0);
                                }
                            } catch {}
                        };
                        
                        ws.onmessage = function(event) {
                            try {
                                const message = JSON.parse(event.data);
                                
                                switch(message.type) {
                                    case 'frontend-reload':
                                        // Agora pode recarregar mesmo com erro.
                                        handleFrontendReload(message.data);
                                        break;
                                    case 'backend-api-reload':
                                        // Backend ainda precisa do callback (server-side). No client, fazemos reload por segurança.
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
                                        notifyHotReloadState('build-error', message.data);
                                        // Em vez de só console.log, manda pro app renderizar UI.
                                        emitBuildError(message.data);
                                        break;
                                    case 'build-complete':
                                        notifyHotReloadState('idle', { build: 'ok' });
                                        clearBuildError();
                                        console.log('[vatts] Build complete');
                                        break;
                                    case 'frontend-error':
                                        console.error('[vatts] Frontend error:', message.data);
                                        break;
                                    case 'hmr-update':
                                        handleHMRUpdate(message.data);
                                        break;
                                }
                            } catch (e) {
                                console.error('[vatts] Erro ao processar mensagem do hot-reload:', e);
                            }
                        };
                        
                        async function handleFrontendReload(data) {
                            // sinaliza no DevIndicator que estamos processando reload
                            notifyHotReloadState('reloading', { type: 'frontend', data: data || null });

                            if (!data || !data.file) {
                                // Sem info suficiente, tenta soft reload mesmo
                                const event = new CustomEvent('hmr:component-update', { 
                                    detail: { file: null, timestamp: Date.now() } 
                                });
                                window.dispatchEvent(event);
                                return;
                            }
                            
                            const file = (data.file || '').toLowerCase();
                            console.log('[vatts] Frontend changed:', data.file);
                            
                            // Mudanças que exigem reload completo
                            const needsFullReload = 
                                file.includes('layout.tsx') ||
                                file.includes('not-found.tsx') ||
                                file.endsWith('.css');
                            
                            if (needsFullReload) {
                                console.log('[vatts] Layout/CSS changed, full reload...');
                                notifyHotReloadState('full-reload', { reason: 'layout/css', file: data.file });
                                window.location.reload();
                                return;
                            }

                            // Espera o bundle (main.js) ser atualizado/servido antes de disparar HMR.
                            // Timeout curtinho pra não travar o dev flow.
                            await waitForMainToBeUpdated(5000, 120);

                            // Dispara um soft reload (HMR via evento capturado pelo React)
                            const ts = Date.now();
                            const event = new CustomEvent('hmr:component-update', { 
                                detail: { file: data.file, timestamp: ts } 
                            });
                            window.dispatchEvent(event);

                            // Após disparar o HMR, pede ao backend o status atual do build.
                            // Isso garante que, se o código ainda estiver com erro, o modal reapareça/atualize.
                            setTimeout(() => requestBuildStatus('after-frontend-reload'), 50);

                            // Se após um tempo o app não marcou sucesso, cai pro reload completo
                            setTimeout(() => {
                                const hmrSuccess = window.__HMR_SUCCESS__;
                                if (hmrSuccess) {
                                    notifyHotReloadState('idle', { success: true, file: data.file });
                                    // Garante sincronização final do status
                                    requestBuildStatus('after-hmr-success');
                                    return;
                                }

                                console.log('[vatts] Soft reload failed, falling back to full reload');
                                notifyHotReloadState('full-reload', { reason: 'hmr-failed', file: data.file });
                                window.location.reload();
                            }, 1200);
                        }
                        
                        function handleHMRUpdate(data) {
                            console.log('[vatts] HMR Update:', data);
                            
                            // Dispara evento customizado para o React capturar
                            const event = new CustomEvent('hmr:update', { 
                                detail: data 
                            });
                            window.dispatchEvent(event);
                        }
                        
                        ws.onclose = function(event) {
                            isConnected = false;
                            
                            // Não tenta reconectar se foi fechamento intencional
                            if (event.code === 1000) {
                                return;
                            }
                            
                            scheduleReconnect();
                        };
                        
                        ws.onerror = function(error) {
                            isConnected = false;
                            // Não loga erros de conexão para evitar spam no console
                        };
                        
                    } catch (error) {
                        console.error('[vatts] Error creating WebSocket:', error);
                        scheduleReconnect();
                    }
                }
                
                function scheduleReconnect() {
                    if (reconnectTimer) {
                        clearTimeout(reconnectTimer);
                    }
                    
                    reconnectAttempts++;
                    
                    // Exponential backoff com jitter
                    const baseInterval = Math.min(reconnectInterval * Math.pow(1.5, reconnectAttempts - 1), maxReconnectInterval);
                    const jitter = Math.random() * 1000; // Adiciona até 1 segundo de variação
                    const finalInterval = baseInterval + jitter;
                    
                    reconnectTimer = setTimeout(() => {
                        if (!isConnected) {
                            connect();
                        }
                    }, finalInterval);
                }
                
                // Detecta quando a página está sendo fechada para evitar reconexões desnecessárias
                window.addEventListener('beforeunload', function() {
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        ws.close(1000, 'Page unloading');
                    }
                    clearTimeout(reconnectTimer);
                });
                
                // Detecta quando a aba fica visível novamente para reconectar se necessário
                document.addEventListener('visibilitychange', function() {
                    if (!document.hidden && !isConnected) {
                        reconnectAttempts = 0; // Reset do contador quando a aba fica ativa
                        connect();
                    }
                });
                
                connect();
            }
        })();
        </script>
        `;
    }

    private clearBackendCache(filePath: string) {
        const absolutePath = path.resolve(filePath);
        delete require.cache[absolutePath];

        // Limpa dependências relacionadas de forma mais eficiente
        const dirname = path.dirname(absolutePath);
        Object.keys(require.cache).forEach(key => {
            if (key.startsWith(dirname)) {
                delete require.cache[key];
            }
        });
    }

    onBackendApiChange(callback: () => void) {
        this.backendApiChangeCallback = callback;
    }

    onFrontendChange(callback: () => void) {
        this.frontendChangeCallback = callback;
    }

    setHotReloadListener(listener: (file: string) => Promise<void> | void) {
        this.customHotReloadListener = listener;
        Console.info('🔌 Hot reload custom listener registered');
    }

    removeHotReloadListener() {
        this.customHotReloadListener = null;
    }

    onBuildComplete(success: boolean, error?: any) {
        if (this.buildCompleteResolve) {
            this.buildCompleteResolve();
            this.buildCompleteResolve = null;
        }
        this.isBuilding = false;

        if (success) {
            this.lastBuildError = null;
        } else {
            this.lastBuildError = error || { message: 'Build failed', ts: Date.now() };
        }

        // Notifica os clientes que o build terminou
        if (success) {
            this.notifyClients('build-complete', { success: true });
        } else {
            this.notifyClients('build-error', this.lastBuildError);
        }
    }

    stop() {
        this.isShuttingDown = true;

        // Limpa todos os debounce timers
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();

        // Para todos os watchers
        this.watchers.forEach(watcher => watcher.close());
        this.watchers = [];

        // Limpa todos os clientes
        this.clients.forEach((client, ws) => {
            clearInterval(client.pingTimer);
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        });
        this.clients.clear();

        // Fecha WebSocket server
        if (this.wss) {
            this.wss.close();
            this.wss = null;
        }
    }
}
