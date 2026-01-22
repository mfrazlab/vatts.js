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
                    map: null // Null map economiza memória se não precisa debugar markdown
                };
            }
        }
    };
};

/**
 * Plugin para CSS/PostCSS Manual (Otimizado para RAM)
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
                    // OTIMIZAÇÃO DE RAM: Removido 'delete require.cache'.
                    // Limpar o cache constantemente fragmenta a memória heap do V8 em processos longos (watch).
                    // Se o usuário alterar o config, ele deve reiniciar o processo.
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

                // OTIMIZAÇÃO: Emite arquivo físico sempre que possível.
                // Strings gigantes de CSS inline consomem muita RAM no bundle JS.
                const referenceId = this.emitFile({
                    type: 'asset',
                    name: path.basename(filePath),
                    source: processedCss
                });

                // Lógica unificada: Usa arquivo externo tanto em Dev quanto Prod.
                // Isso libera a memória que seria usada para stringificar o CSS dentro do JS.
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
            return null;
        }
    };
};

/**
 * Plugin Inteligente para Assets (Otimizado para RAM)
 * - Agora utiliza emissão de arquivos também em DEV para arquivos grandes.
 */
const smartAssetPlugin = (isProduction) => {
    // 4KB - Arquivos maiores que isso viram referência externa.
    // Manter isso baixo economiza MUITA RAM, pois evita strings Base64 gigantes no JS.
    const INLINE_LIMIT = 4096;

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

            // Text files always strings (geralmente pequenos)
            if (type === 'txt') {
                const content = await fs.promises.readFile(cleanId, 'utf8');
                return `export default ${JSON.stringify(content)};`;
            }

            let buffer = await fs.promises.readFile(cleanId);
            const size = buffer.length;

            // Tratamento especial para SVG (inline SVG vs URL)
            if (type === 'svg') {
                if (size < INLINE_LIMIT) {
                    const content = buffer.toString('utf8');
                    const base64 = buffer.toString('base64');
                    buffer = null; // GC Hint
                    return `
                        export default "data:image/svg+xml;base64,${base64}";
                        export const svgContent = ${JSON.stringify(content)};
                    `;
                } else {
                    const referenceId = this.emitFile({
                        type: 'asset',
                        name: path.basename(cleanId),
                        source: buffer
                    });
                    const content = buffer.toString('utf8');
                    buffer = null; // GC Hint
                    return `
                        export default import.meta.ROLLUP_FILE_URL_${referenceId};
                        export const svgContent = ${JSON.stringify(content)};
                    `;
                }
            }

            // Para outros assets:
            // Se for pequeno, Base64 (reduz requests HTTP)
            // Se for grande, Arquivo (reduz uso de RAM e tamanho do bundle JS)
            // Essa lógica agora aplica para DEV e PROD. Base64 em Dev para arquivos grandes era o vilão da RAM.
            if (size < INLINE_LIMIT) {
                const base64 = buffer.toString('base64');
                buffer = null; // Libera memória do buffer bruto imediatamente
                return `export default "data:${type};base64,${base64}";`;
            } else {
                const referenceId = this.emitFile({
                    type: 'asset',
                    name: path.basename(cleanId),
                    source: buffer
                });
                buffer = null; // Libera memória
                return `export default import.meta.ROLLUP_FILE_URL_${referenceId};`;
            }
        }
    };
};

/**
 * Gera a configuração base do Rollup
 */
function createRollupConfig(entryPoint, outdir, isProduction) {
    return {
        input: entryPoint,
        external: nodeBuiltIns,
        // Otimização: Treeshake limpa memória removendo nós da AST não usados
        treeshake: {
            moduleSideEffects: 'no-external', // Mais agressivo, economiza memória
            preset: isProduction ? 'recommended' : 'smallest'
        },

        // Cache desativado em DEV conforme solicitado anteriormente,
        // o que ajuda na RAM pois não mantém a AST antiga em memória.
        cache: isProduction ? true : false,

        perf: false,

        // Limita execuções paralelas de leitura de arquivo internas do Rollup
        maxParallelFileOps: 20,

        plugins: [
            replace({
                preventAssignment: true,
                values: {
                    'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development')
                }
            }),

            tsconfigPathsPlugin(process.cwd()),

            nodeResolve({
                extensions: ['.mjs', '.js', '.json', '.node', '.jsx', '.tsx', '.ts'],
                preferBuiltins: true,
                browser: true,
                dedupe: ['react', 'react-dom']
            }),

            commonjs({
                sourceMap: !isProduction,
                requireReturnsDefault: 'auto',
                // Ignora try-catch dinâmicos para economizar análise
                ignoreTryCatch: true
            }),

            markdownPlugin(),

            // PostCSS Otimizado
            customPostCssPlugin(isProduction),

            // Assets Otimizados (menos Base64)
            smartAssetPlugin(isProduction),

            esbuild({
                include: /\.[jt]sx?$/,
                exclude: /node_modules/,
                sourceMap: !isProduction,
                minify: isProduction,
                legalComments: 'none', // Remove comentários para limpar buffer
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
            // Ignora avisos circulares comuns que enchem o log/buffer
            if (warning.code === 'CIRCULAR_DEPENDENCY' && warning.message.includes('node_modules')) return;
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
            entryFileNames: isProduction ? 'main-[hash].js' : 'main.js',
            chunkFileNames: 'chunks/[name]-[hash].js',
            assetFileNames: 'assets/[name]-[hash][extname]',
            sourcemap: !isProduction,
            // Compacta output para economizar memória de escrita
            compact: isProduction,

            manualChunks(id) {
                if (id.includes('node_modules')) {
                    const normalizedId = id.replace(/\\/g, '/');

                    if (/\/node_modules\/(react|react-dom|scheduler|prop-types|loose-envify|object-assign)\//.test(normalizedId)) {
                        return 'vendor-react';
                    }
                    if (id.includes('framer-motion') || id.includes('@radix-ui')) {
                        return 'vendor-ui';
                    }
                    if (id.includes('lodash') || id.includes('date-fns') || id.includes('axios')) {
                        return 'vendor-utils';
                    }
                    return 'vendor';
                }
            }
        };

        const bundle = await rollup(inputOptions);
        await bundle.write(outputOptions);
        await bundle.close(); // Importante fechar para liberar memória

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
            inlineDynamicImports: true,
            compact: true // Ajuda na RAM
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
    let currentBuildId = 0;
    let lastStartedBuildId = 0;
    const erroredBuildIds = new Set();

    watcher.on('event', event => {

        if (event.code === 'START') {
            currentBuildId += 1;
            lastStartedBuildId = currentBuildId;
            // Dica pro V8 limpar lixo antes de começar um build pesado
            if (global.gc) {
                try { global.gc(); } catch (e) {}
            }
        }

        if (event.code === 'ERROR') {
            erroredBuildIds.add(currentBuildId);

            const errDetails = {
                message: event.error?.message || 'Unknown build error',
                name: event.error?.name,
                stack: event.error?.stack,
                id: event.error?.id,
                loc: event.error?.loc,
                buildId: currentBuildId
            };

            if (hotReloadManager) {
                hotReloadManager.onBuildComplete(false, errDetails);
            }
            else Console.error("Build Error:", event.error);

            if (resolveFirstBuild) resolveFirstBuild();
        }

        if (event.code === 'BUNDLE_END') {
            // CRÍTICO: Fechar o bundle libera a memória dos módulos
            event.result.close();
        }

        if (event.code === 'END') {
            const endBuildId = currentBuildId;
            const hadError = erroredBuildIds.has(endBuildId);

            if (endBuildId === lastStartedBuildId && !hadError) {
                if (hotReloadManager) {
                    hotReloadManager.onBuildComplete(true, { buildId: endBuildId });
                }
            }

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
        const inputOptions = createRollupConfig(entryPoint, outdir, false);

        const outputOptions = {
            dir: outdir,
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
                skipWrite: false,
                // Atraso curto para evitar múltiplos rebuilds rápidos que comem CPU/RAM
                buildDelay: 100
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
            format: 'es',
            sourcemap: true
        };

        const watchOptions = {
            ...inputOptions,
            output: outputOptions,
            watch: {
                exclude: 'node_modules/**',
                clearScreen: false,
                buildDelay: 100
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

        // OTIMIZAÇÃO: Loop sequencial ao invés de Promise.all.
        // Promise.all é mais rápido, mas cria dezenas/centenas de Promises simultâneas na RAM.
        // O loop sequencial é mais gentil com o Garbage Collector.
        for (const item of items) {
            if (excludes.includes(item)) continue;
            const itemPath = path.join(dirPath, item);
            try {
                const info = await stat(itemPath);
                await rm(itemPath, { recursive: info.isDirectory(), force: true });
            } catch (e) {
                // Ignora erro se arquivo sumir durante o loop
            }
        }
    } catch (e) {
        Console.warn(`Warning cleaning directory: ${e.message}`);
    }
}

module.exports = { build, watch, buildWithChunks, watchWithChunks };