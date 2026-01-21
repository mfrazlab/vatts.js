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


program
    .version('1.0.0')
    .description('CLI to manage the application.');

// --- Comando DEV ---
const fs = require('fs');
const path = require('path');
// 'program' já deve estar definido no seu arquivo
// const { program } = require('commander');

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
        const C = require("../api/console")
        const { Levels } = C;
        const Console = C.default
        const sslDir = path.resolve(process.cwd(), 'certs');
        const keyPath = path.join(sslDir, 'key.pem'); // Padrão 1: key.pem
        const certPath = path.join(sslDir, 'cert.pem'); // Padrão 2: cert.pem
        // (Você pode mudar para 'cert.key' se preferir, apenas ajuste os nomes aqui)

        // 2. Verifica se os arquivos existem
        if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
            appOptions.ssl = {
                key: keyPath,
                cert: certPath
            };

            // 3. Adiciona a porta de redirecionamento (útil para o initNativeServer)
            appOptions.ssl.redirectPort = options.httpRedirectPort || 80;

        } else {
            Console.logWithout(Levels.ERROR, null, `Ensure that './certs/key.pem' and './certs/cert.pem' exist.`, `--ssl flag was used, but the files were not found.`)


            process.exit(1); // Encerra o processo com erro
        }
    }

    // 4. Inicia o helper com as opções
    const teste = require("../helpers");
    const t = teste.default(appOptions);
    t.init();
}

// --- Comando DEV ---
program
    .command('dev')
    .description('Starts the application in development mode.')
    .option('-p, --port <number>', 'Specifies the port to run on', '3000')
    .option('-H, --hostname <string>', 'Specifies the hostname to run on', '0.0.0.0')
    .option('--ssl', 'Activates HTTPS/SSL mode (requires ./ssl/key.pem and ./ssl/cert.pem)')
    .option('--http-redirect-port <number>', 'Port for HTTP->HTTPS redirection', '80')
    .action((options) => {
        initializeApp(options, true); // Chama a função com dev: true
    });

// --- Comando START (Produção) ---
program
    .command('start')
    .description('Starts the application in production mode.')
    .option('-p, --port <number>', 'Specifies the port to run on', '3000')
    .option('-H, --hostname <string>', 'Specifies the hostname to run on', '0.0.0.0')
    .option('--ssl', 'Activates HTTPS/SSL mode (requires ./ssl/key.pem and ./ssl/cert.pem)')
    .option('--http-redirect-port <number>', 'Port for HTTP->HTTPS redirection', '80')
    .action((options) => {
        initializeApp(options, false); // Chama a função com dev: false
    });

/**
 * Função corrigida para copiar diretórios recursivamente.
 * Ela agora verifica se um item é um arquivo ou um diretório.
 */
function copyDirRecursive(src, dest) {
    try {
        // Garante que o diretório de destino exista
        fs.mkdirSync(dest, { recursive: true });

        // Usamos { withFileTypes: true } para evitar uma chamada extra de fs.statSync
        const entries = fs.readdirSync(src, { withFileTypes: true });

        for (let entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
                // Se for um diretório, chama a si mesma (recursão)
                copyDirRecursive(srcPath, destPath);
            } else {
                // Se for um arquivo, apenas copia
                fs.copyFileSync(srcPath, destPath);
            }
        }
    } catch (error) {
        console.error(`❌ Erro ao copiar ${src} para ${dest}:`, error);
        // Lança o erro para parar o processo de exportação se a cópia falhar
        throw error;
    }
}


// --- INÍCIO DO SEU CÓDIGO (AGORA CORRIGIDO) ---

program
    .command('export')
    .description('Exports the application as static HTML to the "exported" folder.')
    .option('-o, --output <path>', 'Specifies the output directory', 'exported')
    .option('--assets-dir <path>', 'Directory (inside output) where the .vatts assets will be written', '.vatts')
    .option('--no-html', 'Do not generate index.html (assets only)')
    .option('--output-h-data <file>', 'Write the data-h value from <script id="__vatts_data__" data-h="..."> into this file')
    .action(async (options) => {
        const projectDir = process.cwd();

        // Resolve output:
        // - se vier absoluto, usa como está
        // - se vier relativo, resolve a partir do projeto
        const outputInput = typeof options.output === 'string' && options.output.trim().length
            ? options.output.trim()
            : 'exported';
        const exportDir = path.isAbsolute(outputInput)
            ? path.resolve(outputInput)
            : path.resolve(projectDir, outputInput);

        // Proteções: nunca permitir apagar a raiz do drive (ex: D:\) ou o root do SO (ex: C:\)
        const exportDirResolved = path.resolve(exportDir);
        const exportDirRoot = path.parse(exportDirResolved).root; // ex: 'D:\\'
        const projectDirResolved = path.resolve(projectDir);

        if (exportDirResolved === exportDirRoot) {
            throw new Error(`Refusing to use output directory at drive root: ${exportDirResolved}`);
        }

        // Também evita `--output .` ou `--output ..` que cairia no diretório do projeto (perigoso)
        // Regra: output precisa estar dentro do projeto, ou dentro de uma subpasta do projeto.
        // (mantém comportamento esperado e evita deletar o repo inteiro por acidente)
        const relExportToProject = path.relative(projectDirResolved, exportDirResolved);
        if (relExportToProject === '' || relExportToProject === '.' || relExportToProject.startsWith('..')) {
            throw new Error(
                `Refusing to export to ${exportDirResolved}. Use a subfolder like "exported" or an explicit path inside the project.`
            );
        }

        // assetsDir: sempre relativo ao exportDir (evita escrever fora sem querer)
        // Permite usar '.' (raiz do output)
        const assetsDirInputRaw = typeof options.assetsDir === 'string' ? options.assetsDir : '.vatts';
        const assetsDirInput = assetsDirInputRaw.trim().length ? assetsDirInputRaw.trim() : '.';
        const assetsDirResolved = path.resolve(exportDirResolved, assetsDirInput);
        const relAssetsToExport = path.relative(exportDirResolved, assetsDirResolved);
        if (relAssetsToExport.startsWith('..') || path.isAbsolute(relAssetsToExport)) {
            throw new Error(`Invalid --assets-dir: must be inside output directory. Received: ${assetsDirInputRaw}`);
        }

        // Normaliza a pasta para uso em URL no HTML
        // Se assets-dir for '.', relAssetsToExport vira '' e assetsBaseHref vira './'
        const assetsDirUrl = relAssetsToExport.split(path.sep).join('/').replace(/^\.?\/?/, '');
        const assetsBaseHref = './' + (assetsDirUrl.length ? assetsDirUrl + '/' : '');

        console.log('🚀 Starting export...\n');

        try {
            // 1. Cria a pasta exported (limpa se já existir)
            if (fs.existsSync(exportDirResolved)) {
                console.log('🗑️  Cleaning existing export folder...');
                fs.rmSync(exportDirResolved, { recursive: true, force: true });
            }
            fs.mkdirSync(exportDirResolved, { recursive: true });
            console.log('✅ Export folder created\n');

            // 2. Inicializa e prepara o build
            console.log('🔨 Building application...');
            // ATENÇÃO: Ajuste o caminho deste 'require' conforme a estrutura do seu projeto!
            const teste = require("../helpers");
            const app = teste.default({ dev: false, port: 3000, hostname: '0.0.0.0', framework: 'native' });
            await app.prepare();
            console.log('✅ Build complete\n');


            const distDir = path.join(projectDirResolved, '.vatts');
            if (fs.existsSync(distDir)) {
                console.log('📦 Copying JavaScript files...');
                const exportDistDir = assetsDirResolved;

                copyDirRecursive(distDir, exportDistDir);

                console.log(`✅ JavaScript files copied to: ${path.relative(exportDirResolved, exportDistDir) || '.'}\n`);
            }

            // 4. Copia a pasta public se existir
            const publicDir = path.join(projectDirResolved, 'public');
            if (fs.existsSync(publicDir)) {
                console.log('📁 Copying public files...');
                const exportPublicDir = path.join(exportDirResolved, 'public');

                copyDirRecursive(publicDir, exportPublicDir);

                console.log('✅ Public files copied\n');
            }

            // 5. Gera o index.html (opcional) / ou só renderiza para extrair h-data
            const shouldExtractHData = typeof options.outputHData === 'string' && options.outputHData.trim().length > 0;
            const shouldRenderHtml = Boolean(options.html) || shouldExtractHData;

            if (shouldRenderHtml) {
                const writeHtmlToDisk = Boolean(options.html);

                if (writeHtmlToDisk) {
                    console.log('📝 Generating index.html...');
                } else {
                    console.log('🧩 Rendering HTML to extract h-data (--output-h-data)...');
                }

                // ATENÇÃO: Ajuste os caminhos destes 'requires' conforme a estrutura do seu projeto!
                const { render } = require('../renderer');
                const { loadRoutes, loadLayout, loadNotFound } = require('../router');

                // Carrega as rotas para gerar o HTML
                const userWebDir = path.join(projectDirResolved, 'src', 'web');
                const userWebRoutesDir = path.join(userWebDir, 'routes');

                const routes = loadRoutes(userWebRoutesDir);
                loadLayout(userWebDir);
                loadNotFound(userWebDir);

                // Gera HTML para a rota raiz
                const rootRoute = routes.find(r => r.pattern === '/') || routes[0];

                if (rootRoute) {
                    const mockReq = {
                        url: '/',
                        method: 'GET',
                        headers: { host: 'localhost' },
                        hwebDev: false,
                        hotReloadManager: null
                    };

                    const html = await render({
                        req: mockReq,
                        route: rootRoute,
                        params: {},
                        allRoutes: routes
                    });


                    if (shouldExtractHData) {
                        const m = html.match(/<script\b[^>]*\bid=["']__vatts_data__["'][^>]*\bdata-h=["']([^"']*)["'][^>]*>/i);
                        if (!m || typeof m[1] !== 'string') {
                            throw new Error('Could not find <script id="__vatts_data__" data-h="..."> in rendered HTML.');
                        }

                        const hDataValue = m[1];

                        // O path do arquivo é relativo ao projeto por padrão
                        const outputHDataPathInput = options.outputHData.trim();
                        const outputHDataPath = path.isAbsolute(outputHDataPathInput)
                            ? path.resolve(outputHDataPathInput)
                            : path.resolve(projectDirResolved, outputHDataPathInput);

                        fs.mkdirSync(path.dirname(outputHDataPath), { recursive: true });
                        fs.writeFileSync(outputHDataPath, hDataValue, 'utf8');
                        console.log(`✅ h-data written to: ${outputHDataPath}`);
                    }

                    if (writeHtmlToDisk) {

                        const scriptReplaced = html.replace(/\/_vatts\//g, assetsBaseHref);
                        const indexPath = path.join(exportDirResolved, 'index.html');
                        fs.writeFileSync(indexPath, scriptReplaced, 'utf8');
                        console.log('✅ index.html generated\n');
                    } else {
                        console.log('✅ HTML rendered (no index.html written)\n');
                    }
                }
            } else {
                console.log('⏭️  Skipping index.html generation (--no-html)\n');
            }

            console.log('🎉 Export completed successfully!');
            console.log(`📂 Files exported to: ${exportDirResolved}\n`);

        } catch (error) {
            // Logar o erro completo (com stack trace) é mais útil
            console.error('❌ Error during export:', error);
            process.exit(1);
        }
    });

// Faz o "parse" dos argumentos passados na linha de comando
program.parse(process.argv);
