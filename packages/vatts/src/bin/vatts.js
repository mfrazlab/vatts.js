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


// Registra o ts-node para que o Node.js entenda TypeScript/TSX
require('ts-node').register();

// Registra loaders customizados para arquivos markdown, imagens, etc.
const { registerLoaders} = require('../loaders');
registerLoaders()
const { program } = require('commander');
const fs = require('fs');
const path = require('path');
const { Writable } = require('stream');

// Importa o Console do framework
const ConsoleModule = require('../api/console');
const Console = ConsoleModule.default;
const { Levels, Colors } = ConsoleModule;


program
    .version('1.0.0')
    .description('CLI to manage the application.');

// --- Helpers ---

/**
 * Função centralizada para iniciar a aplicação
 * @param {object} options - Opções vindas do commander
 * @param {boolean} isDev - Define se é modo de desenvolvimento
 */
function initializeApp(options, isDev) {
    const appOptions = {
        dev: isDev,
        port: options.port,
        hostname: options.hostname,
        framework: 'native',
        ssl: null, // Default
    };

    // 1. Verifica se a flag --ssl foi ativada
    if (options.ssl) {
        const sslDir = path.resolve(process.cwd(), 'certs');
        const keyPath = path.join(sslDir, 'key.pem');
        const certPath = path.join(sslDir, 'cert.pem');

        // 2. Verifica se os arquivos existem
        if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
            appOptions.ssl = {
                key: keyPath,
                cert: certPath
            };

            // 3. Adiciona a porta de redirecionamento
            appOptions.ssl.redirectPort = options.httpRedirectPort || 80;

        } else {
            Console.error(`SSL Error: Ensure that './certs/key.pem' and './certs/cert.pem' exist.`);
            process.exit(1);
        }
    }

    // 4. Inicia o helper com as opções
    const helperModule = require("../helpers");
    const helper = helperModule.default(appOptions);
    helper.init();
}

/**
 * Função corrigida para copiar diretórios recursivamente.
 */
function copyDirRecursive(src, dest) {
    try {
        fs.mkdirSync(dest, { recursive: true });
        const entries = fs.readdirSync(src, { withFileTypes: true });

        for (let entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
                copyDirRecursive(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    } catch (error) {
        Console.error(`Error copying ${src} to ${dest}:`, error);
        throw error;
    }
}

// --- Comandos ---

// Comando DEV
program
    .command('dev')
    .description('Starts the application in development mode.')
    .option('-p, --port <number>', 'Specifies the port to run on', '3000')
    .option('-H, --hostname <string>', 'Specifies the hostname to run on', '0.0.0.0')
    .option('--ssl', 'Activates HTTPS/SSL mode (requires ./ssl/key.pem and ./ssl/cert.pem)')
    .option('--http-redirect-port <number>', 'Port for HTTP->HTTPS redirection', '80')
    .action((options) => {
        initializeApp(options, true);
    });

// Comando START (Produção)
program
    .command('start')
    .description('Starts the application in production mode.')
    .option('-p, --port <number>', 'Specifies the port to run on', '3000')
    .option('-H, --hostname <string>', 'Specifies the hostname to run on', '0.0.0.0')
    .option('--ssl', 'Activates HTTPS/SSL mode (requires ./ssl/key.pem and ./ssl/cert.pem)')
    .option('--http-redirect-port <number>', 'Port for HTTP->HTTPS redirection', '80')
    .action((options) => {
        initializeApp(options, false);
    });


// Comando EXPORT
program
    .command('export')
    .description('Exports the application as static HTML to the "exported" folder.')
    .option('-o, --output <path>', 'Specifies the output directory', 'exported')
    .option('--assets-dir <path>', 'Directory (inside output) where the .vatts assets will be written', '.vatts')
    .option('--no-html', 'Do not generate index.html (assets only)')
    .option('--output-h-data <file>', 'Write the data-h value from <script id="__vatts_data__" data-h="..."> into this file')
    .action(async (options) => {
        const projectDir = process.cwd();

        // Resolve output
        const outputInput = typeof options.output === 'string' && options.output.trim().length
            ? options.output.trim()
            : 'exported';
        const exportDir = path.isAbsolute(outputInput)
            ? path.resolve(outputInput)
            : path.resolve(projectDir, outputInput);

        const exportDirResolved = path.resolve(exportDir);
        const exportDirRoot = path.parse(exportDirResolved).root;
        const projectDirResolved = path.resolve(projectDir);

        if (exportDirResolved === exportDirRoot) {
            Console.error(`Refusing to use output directory at drive root: ${exportDirResolved}`);
            process.exit(1);
        }

        const relExportToProject = path.relative(projectDirResolved, exportDirResolved);
        if (relExportToProject === '' || relExportToProject === '.' || relExportToProject.startsWith('..')) {
            Console.error(`Refusing to export to ${exportDirResolved}. Use a subfolder like "exported" or an explicit path inside the project.`);
            process.exit(1);
        }

        // assetsDir
        const assetsDirInputRaw = typeof options.assetsDir === 'string' ? options.assetsDir : '.vatts';
        const assetsDirInput = assetsDirInputRaw.trim().length ? assetsDirInputRaw.trim() : '.';
        const assetsDirResolved = path.resolve(exportDirResolved, assetsDirInput);
        const relAssetsToExport = path.relative(exportDirResolved, assetsDirResolved);
        if (relAssetsToExport.startsWith('..') || path.isAbsolute(relAssetsToExport)) {
            Console.error(`Invalid --assets-dir: must be inside output directory. Received: ${assetsDirInputRaw}`);
            process.exit(1);
        }

        const assetsDirUrl = relAssetsToExport.split(path.sep).join('/').replace(/^\.?\/?/, '');
        const assetsBaseHref = './' + (assetsDirUrl.length ? assetsDirUrl + '/' : '');

        Console.info('Starting export process...');

        try {
            // 1. Limpa pasta de exportação
            if (fs.existsSync(exportDirResolved)) {
                Console.info('Cleaning existing export folder...');
                fs.rmSync(exportDirResolved, { recursive: true, force: true });
            }
            fs.mkdirSync(exportDirResolved, { recursive: true });

            // 2. Build
            Console.info('Building application...');
            const helperModule = require("../helpers");
            // Usando dev: false para produção
            const app = helperModule.default({ dev: false, port: 3000, hostname: '0.0.0.0', framework: 'native' });
            await app.prepare();
            Console.success('Build complete.');


            // 3. Copia JavaScript
            const distDir = path.join(projectDirResolved, '.vatts');
            if (fs.existsSync(distDir)) {
                Console.info('Copying JavaScript files...');
                const exportDistDir = assetsDirResolved;
                copyDirRecursive(distDir, exportDistDir);
            }

            // 4. Copia Public
            const publicDir = path.join(projectDirResolved, 'public');
            if (fs.existsSync(publicDir)) {
                Console.info('Copying public files...');
                const exportPublicDir = path.join(exportDirResolved, 'public');
                copyDirRecursive(publicDir, exportPublicDir);
            }

            // 5. Gera index.html
            const shouldExtractHData = typeof options.outputHData === 'string' && options.outputHData.trim().length > 0;
            const shouldRenderHtml = Boolean(options.html) || shouldExtractHData;

            if (shouldRenderHtml) {
                const writeHtmlToDisk = Boolean(options.html);

                if (writeHtmlToDisk) {
                    Console.info('Generating index.html...');
                } else {
                    Console.info('Rendering HTML for h-data extraction...');
                }

                const { renderAsStream } = require('../renderer');
                const { loadRoutes, loadLayout, loadNotFound } = require('../router');

                const userWebDir = path.join(projectDirResolved, 'src', 'web');
                const userWebRoutesDir = path.join(userWebDir, 'routes');

                const routes = loadRoutes(userWebRoutesDir);
                loadLayout(userWebDir);
                loadNotFound(userWebDir);

                const rootRoute = routes.find(r => r.pattern === '/') || routes[0];

                if (rootRoute) {
                    const mockReq = {
                        url: '/',
                        method: 'GET',
                        headers: { host: 'localhost' },
                        hwebDev: false,
                        hotReloadManager: null
                    };

                    let html = '';
                    let resolveStream;
                    const streamComplete = new Promise(r => resolveStream = r);

                    const mockRes = new Writable({
                        write(chunk, encoding, callback) {
                            html += chunk.toString();
                            callback();
                        }
                    });

                    mockRes.setHeader = () => {};
                    mockRes.statusCode = 200;

                    mockRes.on('finish', () => {
                        resolveStream();
                    });

                    await renderAsStream({
                        req: mockReq,
                        res: mockRes,
                        route: rootRoute,
                        params: {},
                        allRoutes: routes
                    });

                    await streamComplete;

                    if (shouldExtractHData) {
                        const m = html.match(/<script\b[^>]*\bid=["']__vatts_data__["'][^>]*\bdata-h=["']([^"']*)["'][^>]*>/i);
                        if (!m || typeof m[1] !== 'string') {
                            throw new Error('Could not find <script id="__vatts_data__" data-h="..."> in rendered HTML.');
                        }

                        const hDataValue = m[1];
                        const outputHDataPathInput = options.outputHData.trim();
                        const outputHDataPath = path.isAbsolute(outputHDataPathInput)
                            ? path.resolve(outputHDataPathInput)
                            : path.resolve(projectDirResolved, outputHDataPathInput);

                        fs.mkdirSync(path.dirname(outputHDataPath), { recursive: true });
                        fs.writeFileSync(outputHDataPath, hDataValue, 'utf8');
                        Console.success(`h-data written to: ${path.relative(projectDirResolved, outputHDataPath)}`);
                    }

                    if (writeHtmlToDisk) {
                        const scriptReplaced = html.replace(/\/_vatts\//g, assetsBaseHref);
                        const indexPath = path.join(exportDirResolved, 'index.html');
                        fs.writeFileSync(indexPath, scriptReplaced, 'utf8');
                        Console.success('index.html generated.');
                    }
                }
            } else {
                Console.info('Skipping index.html generation.');
            }

            Console.success(`Export completed successfully to: ${path.relative(projectDirResolved, exportDirResolved)}`);

        } catch (error) {
            Console.error('Error during export:', error);
            process.exit(1);
        }
    });

program.parse(process.argv);