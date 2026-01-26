#!/usr/bin/env node

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

// Imports Nativos do Node.js (movidos para o topo)
import http, {IncomingMessage, Server, ServerResponse} from 'http';
import os from 'os';
import {URLSearchParams} from 'url'; // API moderna, substitui 'querystring'
import path from 'path';
// Helpers para integração com diferentes frameworks
import vatts, {FrameworkAdapterFactory} from './index.js'; // Importando o tipo
import type {VattsOptions, VattsConfig, VattsConfigFunction} from './types';
import Console, {Colors} from "./api/console";
import https, { Server as HttpsServer } from 'https'; // <-- ADICIONAR
import fs from 'fs'; // <-- ADICIONAR

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
    const isSSL = options.ssl && options.ssl.key && options.ssl.cert;
    const protocol = isSSL ? 'https' : 'http';
    const localIp = getLocalExternalIp();

    // Estilos Clean
    const labelStyle = Colors.FgGray;
    const urlStyle = Colors.Bright + Colors.FgRed; // Ciano para links é o padrão mais legível
    const now = new Date();
    const time = now.toLocaleTimeString('pt-BR', { hour12: false });
    const timer = ` ${Colors.FgGray}${time}${Colors.Reset}  `

    // Pequeno espaçamento visual antes dos logs de acesso
    console.log('');
    console.log(timer + labelStyle + ' Access on:')
    console.log(' ')
    // 1. Local (Alinhamento: Local tem 6 letras + 4 espaços = 10)
    console.info(timer + `${labelStyle}  ┃  Local:${Colors.Reset}    ${urlStyle}${protocol}://localhost:${options.port}${Colors.Reset}`);

    // 2. Network (Alinhamento: Network tem 8 letras + 2 espaços = 10)
    if (localIp) {
        console.info(timer + `${labelStyle}  ┃  Network:${Colors.Reset}  ${urlStyle}${protocol}://${localIp}:${options.port}${Colors.Reset}`);
    }

    // 3. Infos Extras (Redirect HTTP -> HTTPS)
    if (isSSL && options.ssl?.redirectPort) {
        console.info(timer + `${labelStyle}  ┃  Redirect:${Colors.Reset} ${labelStyle}port ${options.ssl.redirectPort} ➜ https${Colors.Reset}`);
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
        pathRouter: false
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

        const configFileName = path.basename(configPath);
        Console.info(`Loaded ${configFileName}`);

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
        if (req.method === 'GET' || req.method === 'HEAD') {
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
async function initNativeServer(vattsApp: VattsApp, options: VattsOptions, port: number, hostname: string) {
    const time = Date.now();

    const projectDir = options.dir || process.cwd();
    const phase = options.dev ? 'development' : 'production';
    const vattsConfig = await loadVattsConfig(projectDir, phase);
    config = vattsConfig
    // Passa envFiles da config para as opções do vatts
    options.envFiles = vattsConfig.envFiles;

    await vattsApp.prepare();

    const handler = vattsApp.getRequestHandler();
    const msg = Console.dynamicLine(`${Colors.Bright}Starting Vatts.js on port ${options.port}${Colors.Reset}`);

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
        req.setTimeout(vattsConfig.individualRequestTimeout || 30000, () => {
            res.statusCode = 408; // Request Timeout
            res.end('Request timeout');

            // Log de timeout
            if (vattsConfig.accessLogging) {
                const duration = Date.now() - requestStartTime;
                Console.info(`${Colors.FgYellow}${method}${Colors.Reset} ${url} ${Colors.FgRed}408${Colors.Reset} ${Colors.FgGray}${duration}ms${Colors.Reset}`);
            }
        });

        // Intercepta o método end() para logar quando a resposta for enviada
        const originalEnd = res.end.bind(res);
        let hasEnded = false;

        res.end = function(this: ServerResponse, ...args: any[]): any {
            if (!hasEnded && vattsConfig.accessLogging && !url.includes("/api/rpc") && (!url.includes("_vatts/") && !url.includes(".js") && !url.includes(".css") )) {
                hasEnded = true;
                const duration = Date.now() - requestStartTime;
                const statusCode = res.statusCode || 200;

                // Define cor baseada no status code
                let statusColor = Colors.FgGreen; // 2xx
                if (statusCode >= 500) statusColor = Colors.FgRed; // 5xx
                else if (statusCode >= 400) statusColor = Colors.FgYellow; // 4xx
                else if (statusCode >= 300) statusColor = Colors.FgCyan; // 3xx

                // Formata o método com cor
                let methodColor = Colors.FgRed;
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
            req.headers.host = req.headers.host || `localhost:${port}`;


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

    let server: Server | HttpsServer; // O tipo do servidor pode variar
    const isSSL = options.ssl && options.ssl.key && options.ssl.cert;

    if (isSSL && options.ssl) {

        const sslOptions = {
            key: fs.readFileSync(options.ssl.key),
            cert: fs.readFileSync(options.ssl.cert),
            ca: options.ssl.ca ? fs.readFileSync(options.ssl.ca) : undefined
        };

        // 1. Cria o servidor HTTPS principal
        server = https.createServer(sslOptions, requestListener as any);

        // 2. Cria o servidor de REDIRECIONAMENTO (HTTP -> HTTPS)
        const httpRedirectPort = options.ssl.redirectPort;
        http.createServer((req, res) => {
            // Evita host header injection/open redirect: prefere hostname configurado
            const rawHost = String(req.headers['host'] || '').trim();
            const configuredHost = (options.hostname || hostname || '').trim();

            let hostToUse = configuredHost;

            // Se não tiver hostname configurado, tenta usar Host do request com validação básica
            if (!hostToUse) {
                const hostWithoutPort = rawHost.split(':')[0];
                // allowlist: hostname simples (sem espaços, sem barras), e sem caracteres perigosos
                const isValidHost = /^[a-zA-Z0-9.-]+$/.test(hostWithoutPort) && !hostWithoutPort.includes('..');
                hostToUse = isValidHost ? hostWithoutPort : 'localhost';
            }

            // Monta a URL de redirecionamento
            let redirectUrl = `https://${hostToUse}`;
            // Adiciona a porta HTTPS apenas se não for a padrão (443)
            if (port !== 443) {
                redirectUrl += `:${port}`;
            }
            redirectUrl += req.url || '/';

            res.writeHead(301, { 'Location': redirectUrl });
            res.end();
        }).listen(httpRedirectPort, hostname, () => {});

    } else {
        // --- MODO HTTP (Original) ---
        // Cria o servidor HTTP nativo
        server = http.createServer(requestListener as any);
    }

    // Configurações de segurança do servidor (usa configuração personalizada)
    server.setTimeout(vattsConfig.serverTimeout || 35000); // Timeout geral do servidor
    server.maxHeadersCount = vattsConfig.maxHeadersCount || 100; // Limita número de headers
    server.headersTimeout = vattsConfig.headersTimeout || 60000; // Timeout para headers
    server.requestTimeout = vattsConfig.requestTimeout || 30000; // Timeout para requisições

    server.listen(port, hostname, () => {
        sendBox({ ...options, port });
        msg.end(`${Colors.Bright}Ready on port ${Colors.BgGreen} ${options.port} ${Colors.Reset}${Colors.Bright} in ${Date.now() - time}ms${Colors.Reset}\n`);
    });

    // Configura WebSocket para hot reload (Comum a ambos)
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

            console.log(`${Colors.Bright + Colors.FgRed}
${Colors.Bright + Colors.FgRed}              ___ ___  __    ${Colors.FgWhite}        __  
${Colors.Bright + Colors.FgRed}    \\  /  /\\   |   |  /__\`${Colors.FgWhite}        | /__\`    ${Colors.Bright + Colors.FgRed}Vatts${Colors.FgWhite}.js ${Colors.FgGray}(v${require('../package.json').version}) - itsmuzin${Colors.FgMagenta}
${Colors.Bright + Colors.FgRed}     \\/  /~~\\  |   |  .__/ .${Colors.FgWhite}   \\__/ .__/ ${message}
                                     
                                     `)




            const actualPort = options.port || 3000;
            const actualHostname = options.hostname || "0.0.0.0";

            if (framework !== 'native') {
                Console.warn(`The "${framework}" framework was selected, but the init() method only works with the "native" framework. Starting native server...`);
            }



            return await initNativeServer(vattsApp, options, actualPort, actualHostname);
        }
    }
}

// Exporta a função 'app' como nomeada e também como padrão
export default app;
