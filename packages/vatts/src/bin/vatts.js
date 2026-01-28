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

require('ts-node').register();

const { registerLoaders } = require('../loaders');
registerLoaders();

const { program } = require('commander');
const fs = require('fs');
const path = require('path');
const { Writable } = require('stream');

const ConsoleModule = require('../api/console');
const {loadVattsConfig, config, setConfig} = require("../helpers");
const {default: detectFramework} = require("../api/framework");
const {renderAsStream} = require("../renderer");
const Console = ConsoleModule.default;
const { Levels, Colors } = ConsoleModule;

program
    .version('1.0.0')
    .description('CLI to manage the application.');

// --- Helpers ---

function initializeApp(options, isDev) {
    const appOptions = {
        dev: isDev,
        port: options.port,
        hostname: options.hostname,
        framework: 'native',
    };


    const helperModule = require("../helpers");
    const helper = helperModule.default(appOptions);
    helper.init();
}

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

program
    .command('dev')
    .description('Starts the application in development mode.')
    .option('-p, --port <number>', 'Specifies the port to run on', '3000')
    .option('-H, --hostname <string>', 'Specifies the hostname to run on', '0.0.0.0')
    .option('--ssl', 'Activates HTTPS/SSL mode')
    .option('--http-redirect-port <number>', 'Port for HTTP->HTTPS redirection', '80')
    .action((options) => {
        initializeApp(options, true);
    });

program
    .command('start')
    .description('Starts the application in production mode.')
    .option('-p, --port <number>', 'Specifies the port to run on', '3000')
    .option('-H, --hostname <string>', 'Specifies the hostname to run on', '0.0.0.0')
    .option('--ssl', 'Activates HTTPS/SSL mode')
    .option('--http-redirect-port <number>', 'Port for HTTP->HTTPS redirection', '80')
    .action((options) => {
        process.env.NODE_ENV = 'production';
        initializeApp(options, false);
    });

program
    .command('export')
    .description('Exports the application as static HTML to the "exported" folder.')
    .option('-o, --output <path>', 'Specifies the output directory', 'exported')
    .option('--assets-dir <path>', 'Directory where the .vatts assets will be written', '.vatts')
    .option('--no-html', 'Do not generate index.html (assets only)')
    .option('--output-h-data <file>', 'Write the data-h value into this file')
    .action(async (options) => {
        process.env.NODE_ENV = 'production';
        const projectDir = process.cwd();
        const outputInput = (typeof options.output === 'string' && options.output.trim()) || 'exported';
        const exportDirResolved = path.resolve(projectDir, outputInput);

        const projectDirResolved = path.resolve(projectDir);

        if (exportDirResolved === path.parse(exportDirResolved).root) {
            Console.error(`Refusing to use drive root: ${exportDirResolved}`);
            process.exit(1);
        }

        const assetsDirInput = (typeof options.assetsDir === 'string' && options.assetsDir.trim()) || '.vatts';
        const assetsDirResolved = path.resolve(exportDirResolved, assetsDirInput);
        const relAssetsToExport = path.relative(exportDirResolved, assetsDirResolved);

        const assetsBaseHref = '/.' + (relAssetsToExport.split(path.sep).join('/').replace(/^\.?\/?/, '') || '');

        Console.info('Starting export process...');

        try {
            let { loadVattsConfig, setConfig, config } = require("../helpers")
            setConfig(await loadVattsConfig(projectDirResolved, 'production'))
            if (fs.existsSync(exportDirResolved)) {
                Console.info('Cleaning existing export folder...');
                fs.rmSync(exportDirResolved, { recursive: true, force: true });
            }
            fs.mkdirSync(exportDirResolved, { recursive: true });

            Console.info('Building application...');
            const helperModule = require("../helpers");
            const app = helperModule.default({ dev: false, port: 3000, hostname: '0.0.0.0', framework: 'native' });
            await app.prepare();
            Console.success('Build complete.');

            const distDir = path.join(projectDirResolved, '.vatts');
            if (fs.existsSync(distDir)) {
                Console.info('Copying JavaScript files...');
                copyDirRecursive(distDir, assetsDirResolved);
            }

            const publicDir = path.join(projectDirResolved, 'public');
            if (fs.existsSync(publicDir)) {
                Console.info('Copying public files...');
                copyDirRecursive(publicDir, exportDirResolved);
            }

            const shouldExtractHData = !!options.outputHData;
            const shouldRenderHtml = options.html !== false || shouldExtractHData;

            if (shouldRenderHtml) {
                const writeHtmlToDisk = options.html !== false;
                Console.info(writeHtmlToDisk ? 'Generating index.html...' : 'Rendering HTML for h-data extraction...');


                const frameWork = detectFramework(projectDirResolved)
                const { renderAsStream } = require('../renderer');

                const { loadRoutes, loadLayout, loadNotFound } = require('../router');

                const userWebDir = path.join(projectDirResolved, 'src', 'web');
                const userWebRoutesDir = path.join(userWebDir, 'routes');

                // Recarrega rotas para garantir estado limpo
                const routes = loadRoutes(userWebRoutesDir);
                loadLayout(userWebDir);
                loadNotFound(userWebDir);

                if (routes.length === 0) {
                    Console.warn('No routes found in src/web/routes. Skipping HTML generation.');
                } else {
                    const rootRoute = routes.find(r => r.pattern === '/') || routes[0];

                    let htmlResult = '';
                    const mockReq = {
                        url: rootRoute.pattern || '/',
                        method: 'GET',
                        headers: { host: 'localhost' },
                        hwebDev: false,
                        hotReloadManager: null
                    };

                    const mockRes = new Writable({
                        write(chunk, encoding, callback) {
                            htmlResult += chunk.toString();
                            callback();
                        }
                    });

                    // Extensão do mockRes para compatibilidade com o renderer
                    mockRes.setHeader = () => {};
                    mockRes.getHeader = () => {};
                    mockRes.statusCode = 200;
                    mockRes.end = (chunk) => {
                        if (chunk) htmlResult += chunk.toString();
                        mockRes.emit('finish');
                    };

                    const streamComplete = new Promise((resolve, reject) => {
                        mockRes.on('finish', resolve);
                        mockRes.on('error', reject);
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
                        const m = htmlResult.match(/data-h=["']([^"']*)["']/i);
                        if (m && m[1]) {
                            const outputHDataPath = path.resolve(projectDirResolved, options.outputHData.trim());
                            fs.mkdirSync(path.dirname(outputHDataPath), { recursive: true });
                            fs.writeFileSync(outputHDataPath, m[1], 'utf8');
                            Console.success(`h-data written to: ${path.relative(projectDirResolved, outputHDataPath)}`);
                        }
                    }

                    if (writeHtmlToDisk) {
                        // Ajusta caminhos dos scripts para serem relativos ao assetsDir
                        const finalHtml = htmlResult.replace(/\/_vatts\//g, assetsBaseHref.endsWith('/') ? assetsBaseHref : assetsBaseHref + '/');
                        const indexPath = path.join(exportDirResolved, 'index.html');
                        fs.writeFileSync(indexPath, finalHtml, 'utf8');
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