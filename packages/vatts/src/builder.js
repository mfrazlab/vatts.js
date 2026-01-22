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

const { rollup, watch: rollupWatch } = require('rollup');
const path = require('path');
const Console = require("./api/console").default;
const fs = require('fs');
const { readdir, stat, rm } = require("node:fs/promises");


// Plugins Oficiais do Rollup
const nodeResolve = require('@rollup/plugin-node-resolve').default;
const commonjs = require('@rollup/plugin-commonjs').default;
const replace = require('@rollup/plugin-replace').default;
const esbuild = require('rollup-plugin-esbuild').default;
const { loadTsConfigPaths, resolveTsConfigAlias } = require('./tsconfigPaths');

const tsconfigPathsPlugin = (projectDir = process.cwd()) => {
    const info = loadTsConfigPaths(projectDir);

    return {
        name: 'tsconfig-paths-alias',
        async resolveId(source, importer) {
            if (!source || source.startsWith('\0')) return null;
            const candidate = resolveTsConfigAlias(source, info);
            if (!candidate) return null;

            const resolution = await this.resolve(candidate, importer, { skipSelf: true });
            return resolution || candidate;
        }
    };
};

// Lista de módulos nativos do Node.js
const nodeBuiltIns = [
    'assert', 'buffer', 'child_process', 'cluster', 'crypto', 'dgram', 'dns',
    'domain', 'events', 'fs', 'http', 'https', 'net', 'os', 'path', 'punycode',
    'querystring', 'readline', 'stream', 'string_decoder', 'tls', 'tty', 'url',
    'util', 'v8', 'vm', 'zlib', 'module', 'worker_threads', 'perf_hooks'
];

/**
 * Plugin para Markdown
 */
const markdownPlugin = () => {
    return {
        name: 'markdown-loader',
        transform(code, id) {
            if (id.endsWith('.md')) {
                return {
                    code: `export default ${JSON.stringify(code)};`,
                    map: null
                };
            }
        }
    };
};

/**
 * Plugin para CSS/PostCSS Manual (Smart Extraction + Tailwind Fix)
 */
const customPostCssPlugin = (isProduction) => {
    let cachedProcessor = null;
    let configLoaded = false;

    // Função auxiliar para inicializar o PostCSS apenas uma vez
    const initPostCss = async (projectDir) => {
        if (configLoaded) return cachedProcessor;

        // CRÍTICO: Garante que o Tailwind saiba que é produção para purgar CSS não usado
        process.env.NODE_ENV = isProduction ? 'production' : 'development';

        const postcssConfigPath = path.join(projectDir, 'postcss.config.js');
        const postcssConfigMjsPath = path.join(projectDir, 'postcss.config.mjs');
        const configPath = fs.existsSync(postcssConfigPath) ? postcssConfigPath :
            (fs.existsSync(postcssConfigMjsPath) ? postcssConfigMjsPath : null);

        if (configPath) {
            try {
                let postcss;
                try {
                    postcss = require(path.join(projectDir, 'node_modules', 'postcss'));
                } catch {
                    try { postcss = require('postcss'); } catch (e) { return null; }
                }

                if (postcss) {
                    delete require.cache[require.resolve(configPath)];
                    const config = require(configPath);
                    const postcssConfig = config.default || config;

                    const plugins = [];
                    if (postcssConfig.plugins) {
                        if (Array.isArray(postcssConfig.plugins)) {
                            plugins.push(...postcssConfig.plugins.map(p => {
                                if (typeof p === 'string') {
                                    try {
                                        const resolved = require.resolve(p, { paths: [projectDir] });
                                        return require(resolved);
                                    } catch { return require(p); }
                                }
                                return p;
                            }));
                        } else {
                            for (const [name, options] of Object.entries(postcssConfig.plugins)) {
                                try {
                                    const resolvedPath = require.resolve(name, { paths: [projectDir] });
                                    const pluginModule = require(resolvedPath);
                                    plugins.push(pluginModule(options || {}));
                                } catch (e) {
                                    Console.warn(`Unable to load plugin ${name}:`, e.message);
                                }
                            }
                        }
                    }
                    cachedProcessor = postcss(plugins);
                }
            } catch (e) {
                Console.warn(`Error initializing PostCSS:`, e.message);
            }
        }
        configLoaded = true;
        return cachedProcessor;
    };

    return {
        name: 'custom-postcss-plugin',

        async resolveId(source, importer) {
            if (source.startsWith('\0custom-css:')) return null;

            if (source.endsWith('.css')) {
                const resolution = await this.resolve(source, importer, { skipSelf: true });
                if (resolution && resolution.id) {
                    if (resolution.id.startsWith('\0custom-css:')) return resolution.id;
                    return `\0custom-css:${resolution.id}`;
                }
            }
            return null;
        },

        async load(id) {
            if (id.startsWith('\0custom-css:')) {
                let filePath = id.slice('\0custom-css:'.length);
                while (filePath.startsWith('\0custom-css:')) {
                    filePath = filePath.slice('\0custom-css:'.length);
                }

                const cssContent = await fs.promises.readFile(filePath, 'utf8');

                // Usa o processador em cache ou inicializa se for a primeira vez
                const processor = await initPostCss(process.cwd());
                let processedCss = cssContent;

                if (processor) {
                    try {
                        const result = await processor.process(cssContent, {
                            from: filePath,
                            to: filePath
                        });
                        processedCss = result.css;
                    } catch (e) {
                        Console.warn(`PostCSS process error:`, e.message);
                    }
                }

                // ESTRATÉGIA DE EXTRAÇÃO INTELIGENTE
                if (isProduction) {
                    // Emite arquivo físico (Melhora Cache e Tamanho do JS)
                    const referenceId = this.emitFile({
                        type: 'asset',
                        name: path.basename(filePath),
                        source: processedCss
                    });

                    // Retorna código JS que auto-injeta o <link>
                    // Isso mantém compatibilidade (não quebra o app) mas usa arquivo externo
                    return `
                        const cssUrl = import.meta.ROLLUP_FILE_URL_${referenceId};
                        if (typeof document !== 'undefined') {
                            const link = document.createElement('link');
                            link.rel = 'stylesheet';
                            link.href = cssUrl;
                            document.head.appendChild(link);
                        }
                        export default cssUrl;
                    `;
                }

                // Modo DEV (Inline para Hot Reload mais rápido)
                return `
                    const css = ${JSON.stringify(processedCss)};
                    if (typeof document !== 'undefined') {
                        const style = document.createElement('style');
                        style.textContent = css;
                        document.head.appendChild(style);
                    }
                    export default css;
                `;
            }
            return null;
        }
    };
};

/**
 * Plugin Inteligente para Assets (Substitui forceBase64Plugin)
 * - Dev: Base64 (Rápido)
 * - Prod: Arquivos > 4KB viram URL (Melhora LCP), < 4KB Base64 (Menos requests)
 */
const smartAssetPlugin = (isProduction) => {
    const INLINE_LIMIT = 4096; // 4KB

    return {
        name: 'smart-asset-loader',
        async load(id) {
            const cleanId = id.split('?')[0];
            if (cleanId.startsWith('\0')) return null;

            const ext = path.extname(cleanId).slice(1).toLowerCase();

            const mimeTypes = {
                'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
                'gif': 'image/gif', 'webp': 'image/webp', 'avif': 'image/avif',
                'ico': 'image/x-icon', 'bmp': 'image/bmp', 'tif': 'image/tiff',
                'tiff': 'image/tiff', 'woff': 'font/woff', 'woff2': 'font/woff2',
                'ttf': 'font/ttf', 'otf': 'font/otf', 'eot': 'application/vnd.ms-fontobject',
                'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg',
                'm4a': 'audio/mp4', 'aac': 'audio/aac', 'flac': 'audio/flac',
                'mp4': 'video/mp4', 'webm': 'video/webm', 'ogv': 'video/ogg',
                'svg': 'svg', 'txt': 'txt'
            };

            const type = mimeTypes[ext];
            if (!type) return null;

            // Text files always strings
            if (type === 'txt') {
                const content = await fs.promises.readFile(cleanId, 'utf8');
                return `export default ${JSON.stringify(content)};`;
            }

            const buffer = await fs.promises.readFile(cleanId);
            const size = buffer.length;

            // MODO PRODUÇÃO: Otimização de Assets
            if (isProduction) {
                // SVG: Se for pequeno inlina, se grande emite arquivo
                if (type === 'svg') {
                    if (size < INLINE_LIMIT) {
                        const content = buffer.toString('utf8');
                        const base64 = buffer.toString('base64');
                        return `
                            export default "data:image/svg+xml;base64,${base64}";
                            export const svgContent = ${JSON.stringify(content)};
                        `;
                    } else {
                        // Emite arquivo físico
                        const referenceId = this.emitFile({
                            type: 'asset',
                            name: path.basename(cleanId),
                            source: buffer
                        });
                        const content = buffer.toString('utf8');
                        return `
                            export default import.meta.ROLLUP_FILE_URL_${referenceId};
                            export const svgContent = ${JSON.stringify(content)};
                        `;
                    }
                }

                // Outros assets
                if (size < INLINE_LIMIT) {
                    return `export default "data:${type};base64,${buffer.toString('base64')}";`;
                } else {
                    const referenceId = this.emitFile({
                        type: 'asset',
                        name: path.basename(cleanId),
                        source: buffer
                    });
                    return `export default import.meta.ROLLUP_FILE_URL_${referenceId};`;
                }
            }

            // MODO DESENVOLVIMENTO: Tudo Base64 para performance de build
            if (type === 'svg') {
                const content = buffer.toString('utf8');
                const base64 = buffer.toString('base64');
                return `
                    export default "data:image/svg+xml;base64,${base64}";
                    export const svgContent = ${JSON.stringify(content)};
                `;
            }
            return `export default "data:${type};base64,${buffer.toString('base64')}";`;
        }
    };
};

/**
 * Gera a configuração base do Rollup
 */
function createRollupConfig(entryPoint, outdir, isProduction) {
    return {
        input: entryPoint,
        // Para evitar bare imports no browser (sem import map), em DEV também bundle React/ReactDOM.
        // O HMR evita "Invalid hook call" removendo o script antigo e recarregando main.js.
        external: nodeBuiltIns,
        // Otimização: Em prod usa 'recommended' para limpar código morto
        treeshake: isProduction ? 'recommended' : false,

        // CORREÇÃO CRÍTICA: Desativa cache em desenvolvimento (watch mode)
        // Isso previne que o Rollup emita "sucesso" baseado em um cache obsoleto quando o arquivo ainda tem erro.
        cache: isProduction ? true : false,

        perf: false,
        plugins: [
            // CRÍTICO: 'replace' deve vir PRIMEIRO para injetar NODE_ENV antes que
            // libs como React decidam qual bundle importar.
            replace({
                preventAssignment: true,
                values: {
                    'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development')
                }
            }),

            // Precisa vir antes do nodeResolve
            tsconfigPathsPlugin(process.cwd()),

            nodeResolve({
                extensions: ['.mjs', '.js', '.json', '.node', '.jsx', '.tsx', '.ts'],
                preferBuiltins: true,
                browser: true,
                dedupe: ['react', 'react-dom']
            }),

            commonjs({
                sourceMap: !isProduction,
                requireReturnsDefault: 'auto'
            }),

            markdownPlugin(),

            // Passamos isProduction para ativar a Extração Inteligente
            customPostCssPlugin(isProduction),

            // Substitui forceBase64Plugin pelo Smart
            smartAssetPlugin(isProduction),

            esbuild({
                include: /\.[jt]sx?$/,
                exclude: /node_modules/,
                sourceMap: !isProduction,
                minify: isProduction,
                // Otimização: Remove comentários legais em produção
                legalComments: isProduction ? 'none' : 'eof',
                treeShaking: isProduction,
                target: isProduction ? 'es2020' : 'esnext',
                jsx: 'automatic',
                define: { __VERSION__: '"1.0.0"' },
                loaders: { '.json': 'json', '.js': 'jsx' }
            })
        ],
        onwarn(warning, warn) {
            if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
            if (warning.code === 'THIS_IS_UNDEFINED') return;
            warn(warning);
        }
    };
}

/**
 * Builds with code splitting into multiple chunks (ESM Format) - MODO PRODUÇÃO
 */
async function buildWithChunks(entryPoint, outdir, isProduction = false) {
    await cleanDirectoryExcept(outdir, 'temp');

    try {
        const inputOptions = createRollupConfig(entryPoint, outdir, isProduction);

        const outputOptions = {
            dir: outdir,
            format: 'es',
            // Padrão de nomes mantido, mas com estrutura para vários arquivos
            entryFileNames: isProduction ? 'main-[hash].js' : 'main.js',
            chunkFileNames: 'chunks/[name]-[hash].js',
            assetFileNames: 'assets/[name]-[hash][extname]',
            sourcemap: !isProduction,

            // OTIMIZAÇÃO: Separação granular para melhor Cache e Load Time
            manualChunks(id) {
                if (id.includes('node_modules')) {
                    // Normaliza separadores para garantir funcionamento em Windows/Linux
                    const normalizedId = id.replace(/\\/g, '/');

                    // React Core isolado
                    // IMPORTANTE: Uso de Regex para garantir que pegamos APENAS os pacotes do core
                    // e não pacotes que tenham 'react' no nome (ex: react-router, react-icons),
                    // pois isso causa dependências circulares com o chunk 'vendor'.
                    if (/\/node_modules\/(react|react-dom|scheduler|prop-types|loose-envify|object-assign)\//.test(normalizedId)) {
                        return 'vendor-react';
                    }

                    // UI Libs comuns (opcional, pode ajustar conforme necessidade)
                    if (id.includes('framer-motion') || id.includes('@radix-ui')) {
                        return 'vendor-ui';
                    }

                    // Utils comuns
                    if (id.includes('lodash') || id.includes('date-fns') || id.includes('axios')) {
                        return 'vendor-utils';
                    }

                    // Resto das dependências
                    return 'vendor';
                }
            }
        };

        const bundle = await rollup(inputOptions);
        await bundle.write(outputOptions);
        await bundle.close();

    } catch (error) {
        Console.error('An error occurred while building with chunks:', error);
        process.exit(1);
    }
}

/**
 * Builds a single entry point into a single output file (IIFE Format)
 */
async function build(entryPoint, outfile, isProduction = false) {
    const outdir = path.dirname(outfile);
    await cleanDirectoryExcept(outdir, 'temp');

    try {
        const inputOptions = createRollupConfig(entryPoint, outdir, isProduction);
        const outputOptions = {
            file: outfile,
            format: 'iife',
            name: 'Vattsjs',
            sourcemap: !isProduction,
            inlineDynamicImports: true
        };

        const bundle = await rollup(inputOptions);
        await bundle.write(outputOptions);
        await bundle.close();

    } catch (error) {
        Console.error('An error occurred during build:', error);
        process.exit(1);
    }
}

/**
 * Helper para lidar com notificações do Watcher
 */
function handleWatcherEvents(watcher, hotReloadManager, resolveFirstBuild) {
    // Controla o estado do build por "geração" para evitar END atrasado
    // (ou múltiplos ciclos) emitirem sucesso após um erro.
    let currentBuildId = 0;
    let lastStartedBuildId = 0;
    const erroredBuildIds = new Set();

    // DEBUG: stack trace rate-limited
    let lastTraceAt = 0;


    watcher.on('event', event => {

        if (event.code === 'START') {
            currentBuildId += 1;
            lastStartedBuildId = currentBuildId;
        }

        if (event.code === 'ERROR') {
            // Marca erro para o build atualmente em andamento.
            erroredBuildIds.add(currentBuildId);

            const errDetails = {
                message: event.error?.message || 'Unknown build error',
                name: event.error?.name,
                stack: event.error?.stack,
                id: event.error?.id,
                loc: event.error?.loc,
                buildId: currentBuildId
            };

            // Notifica erro imediatamente
            if (hotReloadManager) {
                hotReloadManager.onBuildComplete(false, errDetails);
            }
            else Console.error("Build Error:", event.error);

            if (resolveFirstBuild) resolveFirstBuild();
        }

        if (event.code === 'BUNDLE_END') event.result.close();

        if (event.code === 'END') {
            const endBuildId = currentBuildId;
            const hadError = erroredBuildIds.has(endBuildId);


            // Só emite sucesso se:
            //  1) esse END é do build mais recentemente iniciado (evita END atrasado)
            //  2) esse build não teve ERROR
            if (endBuildId === lastStartedBuildId && !hadError) {
                if (hotReloadManager) {
                    hotReloadManager.onBuildComplete(true, { buildId: endBuildId });
                }
            }

            // Limpa estados antigos pra não crescer sem limite.
            // (qualquer build mais antigo que o último START não faz mais sentido manter)
            for (const id of erroredBuildIds) {
                if (id < lastStartedBuildId) erroredBuildIds.delete(id);
            }

            if (resolveFirstBuild) {
                resolveFirstBuild();
                resolveFirstBuild = null;
            }
        }
    });
}

/**
 * Watches with code splitting enabled
 */
async function watchWithChunks(entryPoint, outdir, hotReloadManager = null) {
    await cleanDirectoryExcept(outdir, 'temp');

    try {
        // DEV MODE: isProduction = false
        const inputOptions = createRollupConfig(entryPoint, outdir, false);

        const outputOptions = {
            dir: outdir,
            // Em DEV usamos ESM para suportar externals como react/react-dom sem output.globals
            format: 'es',
            entryFileNames: 'main.js',
            sourcemap: true
        };

        const watchOptions = {
            ...inputOptions,
            output: outputOptions,
            watch: {
                exclude: 'node_modules/**',
                clearScreen: false,
                skipWrite: false
            }
        };

        const watcher = rollupWatch(watchOptions);
        await new Promise((resolve) => handleWatcherEvents(watcher, hotReloadManager, resolve));
        return watcher;

    } catch (error) {
        Console.error('Error starting watch mode with chunks:', error);
        if (hotReloadManager) hotReloadManager.onBuildComplete(false, { message: error.message });
        throw error;
    }
}

/**
 * Watches an entry point (Single File)
 */
async function watch(entryPoint, outfile, hotReloadManager = null) {
    const outdir = path.dirname(outfile);

    try {
        const inputOptions = createRollupConfig(entryPoint, outdir, false);

        const outputOptions = {
            file: outfile,
            // Em DEV usamos ESM para suportar externals como react/react-dom sem output.globals
            format: 'es',
            sourcemap: true
        };

        const watchOptions = {
            ...inputOptions,
            output: outputOptions,
            watch: {
                exclude: 'node_modules/**',
                clearScreen: false
            }
        };

        const watcher = rollupWatch(watchOptions);
        await new Promise((resolve) => handleWatcherEvents(watcher, hotReloadManager, resolve));
        return watcher;

    } catch (error) {
        Console.error('Error starting watch mode:', error);
        if (hotReloadManager) hotReloadManager.onBuildComplete(false, { message: error.message });
        throw error;
    }
}

async function cleanDirectoryExcept(dirPath, excludeFolder) {
    try {
        if (!fs.existsSync(dirPath)) return;
        const excludes = Array.isArray(excludeFolder) ? excludeFolder : [excludeFolder];
        const items = await readdir(dirPath);

        // Paraleliza a limpeza
        await Promise.all(items.map(async (item) => {
            if (excludes.includes(item)) return;
            const itemPath = path.join(dirPath, item);
            const info = await stat(itemPath);
            await rm(itemPath, { recursive: info.isDirectory(), force: true });
        }));
    } catch (e) {
        Console.warn(`Warning cleaning directory: ${e.message}`);
    }
}

module.exports = { build, watch, buildWithChunks, watchWithChunks };

