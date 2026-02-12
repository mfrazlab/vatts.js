#!/usr/bin/env node

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

// Imports Nativos do Node.js (movidos para o topo)
import http, {IncomingMessage, Server, ServerResponse} from 'http';
import os from 'os';
import {URLSearchParams} from 'url'; // API moderna, substitui 'querystring'
import path from 'path';
import { Duplex } from 'stream'; // Necessário para a ponte do Socket
// Helpers para integração com diferentes frameworks
import vatts, {FrameworkAdapterFactory} from './index.js'; // Importando o tipo
import type {VattsOptions, VattsConfig, VattsConfigFunction} from './types';
import Console, {Colors} from "./api/console";
import https, { Server as HttpsServer } from 'https';
import http2, { Http2SecureServer } from 'http2';
import fs from 'fs';

// Nova API do Servidor Nativo (Go HTTP/3)
import { NativeServer } from "./api/native-server";

// Registra loaders customizados para importar arquivos não-JS
const { registerLoaders } = require('./loaders');
registerLoaders({ projectDir: process.cwd() });

// --- Tipagem ---

/**
 * Interface para a instância principal do vatts, inferida pelo uso.
 */
interface VattsApp {
    prepare: () => Promise<void>;
    // O handler pode ter assinaturas diferentes dependendo do framework
    getRequestHandler: () => (req: any, res: any, next?: any) => Promise<void> | void;
    setupWebSocket: (server: Server | any) => void; // Aceita http.Server ou app (Express/Fastify)
    executeInstrumentation: () => void;
}

/**
 * Estende a request nativa do Node para incluir o body parseado.
 */
interface VattsIncomingMessage extends IncomingMessage {
    body?: object | string | null;
}

// --- Helpers ---

/**
 * Encontra o IP externo local (rede)
 */
function getLocalExternalIp(): string {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        const ifaceList = interfaces[name];
        if (ifaceList) {
            for (const iface of ifaceList) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    return iface.address;
                }
            }
        }
    }
    return 'localhost'; // Fallback
}

const sendBox = (options: VattsOptions) => {
    const isDev = options.dev;
    // @ts-ignore
    const isSSL = config.ssl && config.ssl.key && config.ssl.cert;
    const protocol = isSSL ? 'https' : 'http';
    const localIp = getLocalExternalIp();

    // Estilos Clean
    const labelStyle = Colors.FgGray;
    const urlStyle = Colors.Bright + Colors.FgCyan; // Ciano para links é o padrão mais legível
    const now = new Date();
    const time = now.toLocaleTimeString('pt-BR', { hour12: false });
    const timer = ` ${Colors.FgGray}${time}${Colors.Reset}  `

    // Pequeno espaçamento visual antes dos logs de acesso
    console.log('');
    console.log(timer + labelStyle + ' Access on:')
    console.log(' ')
    // 1. Local (Alinhamento: Local tem 6 letras + 4 espaços = 10)
    console.info(timer + `${labelStyle}  ┃  Local:${Colors.Reset}    ${urlStyle}${protocol}://localhost:${config?.port}${Colors.Reset}`);

    // 2. Network (Alinhamento: Network tem 8 letras + 2 espaços = 10)
    if (localIp) {
        console.info(timer + `${labelStyle}  ┃  Network:${Colors.Reset}  ${urlStyle}${protocol}://${localIp}:${config?.port}${Colors.Reset}`);
    }

    if(config?.ssl?.http3Port) {
        console.info(timer + `${labelStyle}  ┃  HTTP/3:${Colors.Reset}   ${urlStyle}${protocol}://${localIp}:${config.ssl.http3Port}${Colors.Reset}`);
    }

    // 3. Infos Extras (Redirect HTTP -> HTTPS)
    // @ts-ignore
    if (isSSL && config.ssl?.redirectPort) {
        // @ts-ignore
        console.info(timer + `${labelStyle}  ┃  Redirect:${Colors.Reset} ${labelStyle}port ${config.ssl.redirectPort} ➜ https${Colors.Reset}`);
    }

    // 4. Info de Ambiente
    if (isDev) {
        console.info(timer + `${labelStyle}  ┃  Mode:${Colors.Reset}     ${Colors.FgAlmostWhite}development${Colors.Reset}`);
    }

    // Espaçamento final
    console.log('\n');
}

/**
 * Carrega o arquivo de configuração vatts.config.ts ou vatts.config.js do projeto
 * @param projectDir Diretório raiz do projeto
 * @param phase Fase de execução ('development' ou 'production')
 * @returns Configuração mesclada com os valores padrão
 */
export async function loadVattsConfig(projectDir: string, phase: string): Promise<VattsConfig> {
    const defaultConfig: VattsConfig = {
        maxHeadersCount: 100,
        headersTimeout: 60000,
        requestTimeout: 30000,
        serverTimeout: 35000,
        individualRequestTimeout: 30000,
        maxUrlLength: 2048,
        accessLogging: true,
        envFiles: [],
        pathRouter: false,
        port: 3000,
        // backendPort removido do padrão lógico, mas mantido na tipagem se necessário para compatibilidade retroativa
    };

    try {
        // Tenta primeiro .ts, depois .js
        const possiblePaths = [
            path.join(projectDir, 'vatts.config.ts'),
            path.join(projectDir, 'vatts.config.js'),
        ];

        let configPath: string | null = null;
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                configPath = p;
                break;
            }
        }

        if (!configPath) {
            return defaultConfig;
        }

        // Remove do cache para permitir hot reload da configuração em dev
        delete require.cache[require.resolve(configPath)];

        const configModule = require(configPath);
        const configExport = configModule.default || configModule;

        let userConfig: VattsConfig;

        if (typeof configExport === 'function') {
            // Suporta tanto função síncrona quanto assíncrona
            userConfig = await Promise.resolve(
                (configExport as VattsConfigFunction)(phase, { defaultConfig })
            );
        } else {
            userConfig = configExport;
        }

        // Mescla a configuração do usuário com a padrão
        const mergedConfig = { ...defaultConfig, ...userConfig };


        return mergedConfig;
    } catch (error) {
        if (error instanceof Error) {
            Console.warn(`${Colors.FgYellow}[Config]${Colors.Reset} Error loading vatts.config: ${error.message}`);
            Console.warn(`${Colors.FgYellow}[Config]${Colors.Reset} Using default configuration`);
        }
        return defaultConfig;
    }
}

/**
 * Aplica headers CORS na resposta baseado na configuração.
 * @param req Requisição HTTP
 * @param res Resposta HTTP
 * @param corsConfig Configuração de CORS
 * @returns true se a requisição foi finalizada (OPTIONS), false caso contrário
 */
function applyCors(req: IncomingMessage, res: ServerResponse, corsConfig?: VattsConfig['cors']): boolean {
    if (!corsConfig || !corsConfig.enabled) {
        return false;
    }

    const origin = req.headers.origin || req.headers.referer;

    // Verifica se a origem é permitida
    let allowOrigin = false;
    if (corsConfig.origin === '*') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        allowOrigin = true;
    } else if (typeof corsConfig.origin === 'string' && origin === corsConfig.origin) {
        res.setHeader('Access-Control-Allow-Origin', corsConfig.origin);
        allowOrigin = true;
    } else if (Array.isArray(corsConfig.origin) && origin && corsConfig.origin.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        allowOrigin = true;
    } else if (typeof corsConfig.origin === 'function' && origin) {
        try {
            if (corsConfig.origin(origin)) {
                res.setHeader('Access-Control-Allow-Origin', origin);
                allowOrigin = true;
            }
        } catch (error) {
            Console.warn(`${Colors.FgYellow}[CORS]${Colors.Reset} Error validating origin: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Se a origem não for permitida e não for wildcard, não aplica outros headers
    if (!allowOrigin && corsConfig.origin !== '*') {
        return false;
    }

    // Credenciais (não pode ser usado com origin: '*')
    if (corsConfig.credentials && corsConfig.origin !== '*') {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // Métodos permitidos
    const methods = corsConfig.methods || ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
    res.setHeader('Access-Control-Allow-Methods', methods.join(', '));

    // Headers permitidos
    const allowedHeaders = corsConfig.allowedHeaders || ['Content-Type', 'Authorization'];
    res.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(', '));

    // Headers expostos
    if (corsConfig.exposedHeaders && corsConfig.exposedHeaders.length > 0) {
        res.setHeader('Access-Control-Expose-Headers', corsConfig.exposedHeaders.join(', '));
    }

    // Max age para cache de preflight
    const maxAge = corsConfig.maxAge !== undefined ? corsConfig.maxAge : 86400;
    res.setHeader('Access-Control-Max-Age', maxAge.toString());

    // Responde requisições OPTIONS (preflight)
    if (req.method === 'OPTIONS') {
        res.statusCode = 204; // No Content
        res.end();
        return true;
    }

    return false;
}

/**
 * Middleware para parsing do body com proteções de segurança (versão melhorada).
 */

const parseBody = (req: IncomingMessage): Promise<object | string | null> => {
    // Constantes para limites de segurança
    const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB limite total
    const MAX_JSON_SIZE = 1 * 1024 * 1024; // 1MB limite para JSON
    const BODY_TIMEOUT = 30000; // 30 segundos

    return new Promise((resolve, reject) => {
        if (req.method === 'GET' || req.method === 'HEAD' || req.headers.upgrade) {
            resolve(null);
            return;
        }

        let body = '';
        let totalSize = 0;

        // Timeout para requisições lentas
        const timeout = setTimeout(() => {
            req.destroy();
            reject(new Error('Request body timeout'));
        }, BODY_TIMEOUT);

        req.on('data', (chunk: Buffer) => {
            totalSize += chunk.length;

            // Proteção contra DoS (Payload Too Large)
            if (totalSize > MAX_BODY_SIZE) {
                clearTimeout(timeout);
                req.destroy();
                reject(new Error('Request body too large'));
                return;
            }
            body += chunk.toString();
        });

        req.on('end', () => {
            clearTimeout(timeout);

            if (!body) {
                resolve(null);
                return;
            }

            try {
                const contentType = req.headers['content-type'] || '';

                if (contentType.includes('application/json')) {
                    if (body.length > MAX_JSON_SIZE) {
                        reject(new Error('JSON body too large'));
                        return;
                    }
                    // Rejeita promise se o JSON for inválido
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        reject(new Error('Invalid JSON body'));
                    }
                } else if (contentType.includes('application/x-www-form-urlencoded')) {
                    // Usa API moderna URLSearchParams (segura contra prototype pollution)
                    resolve(Object.fromEntries(new URLSearchParams(body)));
                } else {
                    resolve(body); // Fallback para texto plano
                }
            } catch (error) {
                // Pega qualquer outro erro síncrono
                reject(error);
            }
        });

        req.on('error', (error: Error) => {
            clearTimeout(timeout);
            reject(error);
        });
    });
};

export let config: VattsConfig | undefined
export function setConfig(newConfig: VattsConfig) {
    config = newConfig
}
/**
 * Inicializa servidor nativo do Vatts.js usando HTTP ou HTTPS
 */
async function initNativeServer(vattsApp: VattsApp, options: VattsOptions, hostname: string, vattsConfig: VattsConfig) {
    const time = Date.now();

    config = vattsConfig
    // Passa envFiles da config para as opções do vatts
    options.envFiles = vattsConfig.envFiles;

    await vattsApp.prepare();

    const handler = vattsApp.getRequestHandler();
    const msg = Console.dynamicLine(`${Colors.Bright}Starting Vatts.js on port ${config?.port}${Colors.Reset}`);

    // --- LÓGICA DO LISTENER (REUTILIZÁVEL) ---
    // Extraímos a lógica principal para uma variável
    // para que possa ser usada tanto pelo servidor HTTP quanto HTTPS.
    const requestListener = async (req: VattsIncomingMessage, res: ServerResponse) => {
        const requestStartTime = Date.now();
        const method = req.method || 'GET';
        const url = req.url || '/';

        // Aplica CORS se configurado
        const corsHandled = applyCors(req, res, vattsConfig.cors);
        if (corsHandled) {
            // Requisição OPTIONS foi respondida pelo CORS
            if (vattsConfig.accessLogging) {
                const duration = Date.now() - requestStartTime;
                Console.logCustomLevel('OPTIONS', true, Colors.BgMagenta, `${url} ${Colors.FgGreen}204${Colors.Reset} ${Colors.FgGray}${duration}ms${Colors.Reset} ${Colors.FgCyan}[CORS]${Colors.Reset}`);
            }
            return;
        }

        // Configurações de segurança básicas
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

        // [NOVO] Injeção Alt-Svc se HTTP/3 estiver ativo
        // O Go irá propagar este header para o cliente
        if (vattsConfig.ssl && vattsConfig.ssl.http3Port) {
            console.log("setando header alt-svc para HTTP/3 na porta", vattsConfig.ssl.http3Port);
            res.setHeader('Alt-Svc', `h3=":${vattsConfig.ssl.http3Port}"; ma=2592000`);
        }

        // Aplica headers de segurança configurados
        if (vattsConfig.security?.contentSecurityPolicy) {
            res.setHeader('Content-Security-Policy', vattsConfig.security.contentSecurityPolicy);
        }

        if (vattsConfig.security?.permissionsPolicy) {
            res.setHeader('Permissions-Policy', vattsConfig.security.permissionsPolicy);
        }

        const hstsValue = vattsConfig.security?.strictTransportSecurity || 'max-age=31536000; includeSubDomains';
        res.setHeader('Strict-Transport-Security', hstsValue);

        // Aplica headers personalizados
        if (vattsConfig.customHeaders) {
            for (const [headerName, headerValue] of Object.entries(vattsConfig.customHeaders)) {
                res.setHeader(headerName, headerValue);
            }
        }

        // Timeout por requisição (usa configuração personalizada)
        // WebSocket não deve ter timeout de requisição padrão HTTP
        if (!req.headers.upgrade) {
            req.setTimeout(vattsConfig.individualRequestTimeout || 30000, () => {
                res.statusCode = 408; // Request Timeout
                res.end('Request timeout');

                // Log de timeout
                if (vattsConfig.accessLogging) {
                    const duration = Date.now() - requestStartTime;
                    Console.info(`${Colors.FgYellow}${method}${Colors.Reset} ${url} ${Colors.FgRed}408${Colors.Reset} ${Colors.FgGray}${duration}ms${Colors.Reset}`);
                }
            });
        }

        // Intercepta o método end() para logar quando a resposta for enviada
        const originalEnd = res.end.bind(res);
        let hasEnded = false;

        res.end = function(this: ServerResponse, ...args: any[]): any {
            if (!hasEnded && vattsConfig.accessLogging && !url.includes("/api/rpc") && (!url.includes("_vatts/") && !url.includes(".js") && !url.includes(".css") && !url.includes("hotreload"))) {
                hasEnded = true;
                const duration = Date.now() - requestStartTime;
                const statusCode = res.statusCode || 200;

                // Define cor baseada no status code
                let statusColor = Colors.FgGreen; // 2xx
                if (statusCode >= 500) statusColor = Colors.FgRed; // 5xx
                else if (statusCode >= 400) statusColor = Colors.FgYellow; // 4xx
                else if (statusCode >= 300) statusColor = Colors.FgCyan; // 3xx

                // Formata o método com cor
                let methodColor = Colors.FgCyan;
                if (method === 'POST') methodColor = Colors.FgGreen;
                else if (method === 'PUT') methodColor = Colors.FgYellow;
                else if (method === 'DELETE') methodColor = Colors.FgRed;
                else if (method === 'PATCH') methodColor = Colors.FgMagenta;
                Console.logCustomLevel(method, true, methodColor, `${url} ${statusColor}${statusCode}${Colors.Reset} ${Colors.FgGray}${duration}ms${Colors.Reset}`);
            }
            // @ts-ignore
            return originalEnd.apply(this, args);
        } as any;

        try {
            // Validação básica de URL (usa configuração personalizada)
            const maxUrlLength = vattsConfig.maxUrlLength || 2048;
            if (url.length > maxUrlLength) {
                res.statusCode = 414; // URI Too Long
                res.end('URL too long');
                return;
            }

            // Parse do body com proteções
            req.body = await parseBody(req); // Assumindo que parseBody existe

            // Adiciona host se não existir (necessário para `new URL`)
            req.headers.host = req.headers.host || `localhost:${config?.port}`;


            await handler(req, res);

        } catch (error) {
            // Log do erro no servidor
            if (error instanceof Error) {
                Console.error(`Native server error: ${error.message}`);
            } else {
                Console.error('Unknown native server error:', error);
            }

            // Tratamento de erro (idêntico ao seu original)
            if (!res.headersSent) {
                res.setHeader('Content-Type', 'text/plain');
                if (error instanceof Error) {
                    if (error.message.includes('too large')) {
                        res.statusCode = 413; // Payload Too Large
                        res.end('Request too large');
                    } else if (error.message.includes('timeout')) {
                        res.statusCode = 408; // Request Timeout
                        res.end('Request timeout');
                    } else if (error.message.includes('Invalid JSON')) {
                        res.statusCode = 400; // Bad Request
                        res.end('Invalid JSON body');
                    } else {
                        res.statusCode = 500;
                        res.end('Internal server error');
                    }
                } else {
                    res.statusCode = 500;
                    res.end('Internal server error');
                }
            }
        }
    };
    // --- FIM DO LISTENER ---

    // Sempre criamos um servidor HTTP padrão do Node.js para processar a lógica.
    // Mas ele NÃO vai escutar em nenhuma porta TCP ou Socket de arquivo.
    // Ele será alimentado exclusivamente pela ponte de memória do NativeServer.
    const server = http.createServer(requestListener as any);

    // Configurações de timeout (aplicam-se ao backend)
    server.setTimeout(vattsConfig.serverTimeout || 35000);
    // @ts-ignore
    if (server.maxHeadersCount) server.maxHeadersCount = vattsConfig.maxHeadersCount || 100;
    // @ts-ignore
    if (server.headersTimeout) server.headersTimeout = vattsConfig.headersTimeout || 60000;
    // @ts-ignore
    if (server.requestTimeout) server.requestTimeout = vattsConfig.requestTimeout || 30000;

    const isSSL = !!(config.ssl && config.ssl.key && config.ssl.cert);

    // --- NOVA ARQUITETURA: Native Bridge (Todos os SOs) ---
    // Substitui node:net e arquivos .sock.
    // Cria um stream Duplex virtual para cada requisição que chega do Go.

    const connections = new Map<number, Duplex>();

    // Ponte virtual: Go <-> Memória <-> Node HTTP Parser
    class NativeBridge extends Duplex {
        constructor(public connId: number) {
            super({
                // Removemos decodeStrings: false para permitir que o parser interno (se existir) funcione,
                // mas implementamos nosso próprio parser no _write para garantir a conversão.
                allowHalfOpen: true
            });
        }

        // Propriedades para simular net.Socket
        remoteAddress = '127.0.0.1';
        remoteFamily = 'IPv4';
        remotePort = 0;
        localAddress = '127.0.0.1';
        localPort = 0;

        // Implementa métodos do net.Socket
        setNoDelay(noDelay?: boolean) { return this; }
        setKeepAlive(enable?: boolean, initialDelay?: number) { return this; }
        ref() { return this; }
        unref() { return this; }

        // Implementa setTimeout para satisfazer a interface do net.Socket usada pelo http.Server
        setTimeout(msecs: number, callback?: () => void) {
            if (msecs === 0) return this; // Disable timeout (comum em WS)
            if (callback) {
                this.once('timeout', callback);
            }
            return this;
        }

        _read(size: number) {
            // No-op: Os dados são empurrados externamente pelo onData do NativeServer
        }

        _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
            try {
                // Parser simples: Se vier string, converte para Buffer antes de enviar.
                // Isso resolve problemas onde o ws tenta mandar texto mas a ponte espera bytes crus.
                const buffer = typeof chunk === 'string'
                    ? Buffer.from(chunk, encoding)
                    : chunk;

                // Node respondeu -> Envia de volta para o Go via CGO
                NativeServer.write(this.connId, buffer);
                callback();
            } catch (err: any) {
                callback(err);
            }
        }

        _final(callback: (error?: Error | null) => void) {
            NativeServer.closeConnection(this.connId);
            callback();
        }

        _destroy(error: Error | null, callback: (error: Error | null) => void) {
            NativeServer.closeConnection(this.connId);
            callback(error);
        }
    }

    // Configura portas para o Go StartServer
    const publicPort = config.port || (isSSL ? 443 : 3000);
    let goHttpPort = "";
    let goHttpsPort = "";
    let certPath = "";
    let keyPath = "";

    if (isSSL) {
        // SSL: HTTP faz redirect (80 por padrão), HTTPS é a principal
        const redirectPort = config.ssl?.redirectPort || 80;
        goHttpPort = `:${redirectPort}`;
        goHttpsPort = `:${publicPort}`;
        certPath = config?.ssl?.cert || "";
        keyPath = config?.ssl?.key || "";
    } else {
        // Non-SSL: HTTP é a principal
        goHttpPort = `:${publicPort}`;
        // httpsPort vazio diz pro Go não iniciar TLS
    }

    try {
        NativeServer.start({
            httpPort: goHttpPort,
            httpsPort: goHttpsPort,
            certPath: certPath,
            keyPath: keyPath,
            http3Port: config.ssl?.http3Port ? `:${config.ssl?.http3Port}` : "",
            devMode: options.dev ? "true" : "false",
            // Callback: Chegou dados do Go (Browser -> Go -> Node)
            onData: (connId, data) => {
                let bridge = connections.get(connId);

                if (!bridge) {
                    // Nova requisição/conexão
                    bridge = new NativeBridge(connId);
                    connections.set(connId, bridge);

                    // Simula uma conexão TCP chegando no servidor Node
                    // O servidor começa a ler do stream 'bridge' e parsear o HTTP
                    server.emit('connection', bridge);

                    // Limpeza local
                    bridge.on('close', () => {
                        connections.delete(connId);
                    });
                }

                // Empurra os dados (Buffer cru) para o parser do Node
                bridge.push(data);
            },
            // Callback: Conexão fechou lá no Go
            onClose: (connId) => {
                const bridge = connections.get(connId);
                if (bridge) {
                    bridge.push(null); // EOF
                    bridge.destroy();
                    connections.delete(connId);
                }
            }
        });

        // Atualiza UI
        sendBox({ ...options });


        const httpLabel = vattsConfig.ssl?.http3Port ? `HTTP/3 (${vattsConfig.ssl?.http3Port || ''})` : "HTTP/2";
        const modeLabel = isSSL ? httpLabel : "HTTP (Shield active)";
        msg.end(
            `${Colors.Bright}Ready on port ${Colors.BgGreen} ${publicPort} (${modeLabel}) ${Colors.Reset}\n` +
            `${Colors.Dim} ↳ Engine running on Native Bridge in ${Date.now() - time}ms${Colors.Reset}\n`
        );


        // MANTÉM O PROCESSO VIVO
        // Como não chamamos server.listen(), o event loop do Node ficaria vazio e o processo morreria.
        // Este intervalo mantém o processo rodando para processar os callbacks do CGO.
        setInterval(() => {}, 2147483647);

    } catch (e: any) {
        Console.error(`${Colors.FgRed}[Critical] Failed to start Native Server:`, e);

        // Graceful shutdown
        console.log(`${Colors.FgGray}Shutting down gracefully...${Colors.Reset}`);
        setTimeout(() => {
            process.exit(1);
        }, 1000);
    }

    // Configura WebSocket (Funciona através do Proxy pois ele suporta upgrade de conexão via raw bytes)
    vattsApp.setupWebSocket(server);
    vattsApp.executeInstrumentation();

    return server;
}
// --- Função Principal ---

export function app(options: VattsOptions = {}) {
    const framework = options.framework || 'native';
    FrameworkAdapterFactory.setFramework(framework)

    // Tipando a app principal do vatts
    const vattsApp: VattsApp = vatts(options);

    return {
        ...vattsApp,

        /**
         * Integra com uma aplicação de qualquer framework (Express, Fastify, etc)
         * O 'serverApp: any' é mantido para flexibilidade, já que pode ser de tipos diferentes.
         */
        integrate: async (serverApp: any) => {
            await vattsApp.prepare();
            const handler = vattsApp.getRequestHandler();

            // O framework é setado nas opções do vatts, que deve
            // retornar o handler correto em getRequestHandler()
            // A lógica de integração original parece correta.

            if (framework === 'express') {
                const express = require('express');
                try {
                    const cookieParser = require('cookie-parser');
                    serverApp.use(cookieParser());
                } catch (e) {
                    Console.error("Could not find cookie-parser");
                }
                serverApp.use(express.json());
                serverApp.use(express.urlencoded({ extended: true }));
                serverApp.use(handler);
                vattsApp.setupWebSocket(serverApp);

            } else if (framework === 'fastify') {
                try {
                    await serverApp.register(require('@fastify/cookie'));
                } catch (e) {
                    Console.error("Could not find @fastify/cookie");
                }
                try {
                    await serverApp.register(require('@fastify/formbody'));
                } catch (e) {
                    Console.error("Could not find @fastify/formbody");
                }
                await serverApp.register(async (fastify: any) => {
                    fastify.all('*', handler);
                });
                vattsApp.setupWebSocket(serverApp);

            } else {
                // Generic integration (assume Express-like)
                serverApp.use(handler);
                vattsApp.setupWebSocket(serverApp);
            }

            vattsApp.executeInstrumentation();
            return serverApp;
        },

        /**
         * Inicia um servidor Vatts.js fechado (o usuário não tem acesso ao framework)
         */
        init: async () => {
            const projectDir = options.dir || process.cwd();
            const phase = options.dev ? 'development' : 'production';
            const vattsConfig = await loadVattsConfig(projectDir, phase);
            config = vattsConfig
            const currentVersion = require('../package.json').version;

            async function verifyVersion(): Promise<string> {
                // node fetch
                try {
                    const response = await fetch('https://registry.npmjs.org/vatts/latest');
                    const data = await response.json();
                    return data.version;
                } catch (error) {
                    Console.error('Could not check for the latest Vatts.js version:', error);
                    return currentVersion; // Retorna a versão atual em caso de erro
                }
            }
            const latestVersion = await verifyVersion();
            const isUpToDate = latestVersion === currentVersion;
            let message;
            if (!isUpToDate) {
                message = `${Colors.FgRed}   A new version is available (v${latestVersion})${Colors.FgMagenta}`
            } else {
                message = `${Colors.FgGreen}   You are on the latest version${Colors.FgMagenta}`
            }
            // JS STICK LETTERS

            console.log(`${Colors.Bright + Colors.FgCyan}
${Colors.Bright + Colors.FgCyan}                ___ ___  __    ${Colors.FgWhite}        __  
${Colors.Bright + Colors.FgCyan}    \\  /  /\\   |   |  /__\`${Colors.FgWhite}        | /__\`    ${Colors.Bright + Colors.FgCyan}Vatts${Colors.FgWhite}.js ${Colors.FgGray}(v${require('../package.json').version}) - mfraz
${Colors.Bright + Colors.FgCyan}     \\/  /~~\\  |   |  .__/ .${Colors.FgWhite}   \\__/ .__/ ${message}
                                     
                                     `)




            const actualHostname = options.hostname || "0.0.0.0";

            if (framework !== 'native') {
                Console.warn(`The "${framework}" framework was selected, but the init() method only works with the "native" framework. Starting native server...`);
            }

            return await initNativeServer(vattsApp, options, actualHostname, config);
        }
    }
}

// Exporta a função 'app' como nomeada e também como padrão
export default app;