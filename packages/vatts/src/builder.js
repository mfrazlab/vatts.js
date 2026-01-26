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
const jsonPlugin = require("@rollup/plugin-json").default

const { loadTsConfigPaths, resolveTsConfigAlias } = require('./tsconfigPaths');

// --- Helper de Detecção de Framework ---

function detectFramework(projectDir = process.cwd()) {
    try {
        const pkgPath = path.join(projectDir, 'package.json');
        if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };

            if (deps.react || deps['react-dom']) return 'react';
            if (deps.vue || deps['nuxt']) return 'vue';
        }
    } catch (e) {}

    return 'react';
}

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
 * [CORREÇÃO] Plugin que injeta 'export default {}' se estiver faltando.
 * Resolve o problema de rotas que exportam apenas 'config' mas não o componente.
 */
const vueScriptFixPlugin = () => {
    return {
        name: 'vatts-vue-script-fix',
        transform(code, id) {
            // Intercepta arquivos virtuais de script TS do Vue
            if (id.includes('?vue&type=script') && id.includes('lang.ts')) {
                // Se o código NÃO tem export default, a gente cria um objeto vazio
                // Isso satisfaz o Rollup/Vue Plugin que espera um componente
                if (!code.includes('export default')) {
                    return {
                        code: code + '\nexport default {};',
                        map: null // Sourcemap null pra simplificar
                    };
                }
            }
            return null;
        }
    };
};

/**
 * Plugin para CSS/PostCSS Manual (Otimizado para RAM)
 */
const customPostCssPlugin = (isProduction) => {
    let cachedProcessor = null;
    let configLoaded = false;

    const initPostCss = async (projectDir) => {
        if (configLoaded) return cachedProcessor;

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

        async transform(code, id) {
            if (!id.endsWith('.css')) return null;

            const processor = await initPostCss(process.cwd());
            let processedCss = code;

            if (processor) {
                try {
                    const result = await processor.process(code, {
                        from: id,
                        to: id,
                        map: false
                    });
                    processedCss = result.css;
                } catch (e) {
                    Console.warn(`PostCSS process error:`, e.message);
                }
            }

            const cleanName = path.basename(id).split('?')[0];

            const referenceId = this.emitFile({
                type: 'asset',
                name: cleanName,
                source: processedCss
            });

            return {
                code: `
                const cssUrl = String(import.meta.ROLLUP_FILE_URL_${referenceId});
                if (typeof document !== 'undefined') {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = cssUrl;
                    document.head.appendChild(link);
                }
                export default cssUrl;
            `,
                map: { mappings: '' }
            };
        }
    };
};

/**
 * Plugin Inteligente para Assets (Otimizado para RAM)
 */
const smartAssetPlugin = (isProduction) => {
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

            if (type === 'txt') {
                const content = await fs.promises.readFile(cleanId, 'utf8');
                return `export default ${JSON.stringify(content)};`;
            }

            let buffer = await fs.promises.readFile(cleanId);
            const size = buffer.length;

            if (type === 'svg') {
                if (size < INLINE_LIMIT) {
                    const content = buffer.toString('utf8');
                    const base64 = buffer.toString('base64');
                    buffer = null;
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
                    buffer = null;
                    return `
                        export default String(import.meta.ROLLUP_FILE_URL_${referenceId});
                        export const svgContent = ${JSON.stringify(content)};
                    `;
                }
            }

            if (size < INLINE_LIMIT) {
                const base64 = buffer.toString('base64');
                buffer = null;
                return `export default "data:${type};base64,${base64}";`;
            } else {
                const referenceId = this.emitFile({
                    type: 'asset',
                    name: path.basename(cleanId),
                    source: buffer
                });
                buffer = null;
                return `export default String(import.meta.ROLLUP_FILE_URL_${referenceId});`;
            }
        }
    };
};

/**
 * Gera a configuração base do Rollup
 */
async function createRollupConfig(entryPoint, outdir, isProduction) {
    const framework = detectFramework();
    const hasVue = framework === 'vue';
    const hasReact = framework === 'react';

    const replaceValues = {
        'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
        'process.env.PORT': JSON.stringify(process.vatts.port || 3000)
    };

    let vuePlugin = null;
    if (hasVue) {
        replaceValues['__VUE_OPTIONS_API__'] = JSON.stringify(true);
        replaceValues['__VUE_PROD_DEVTOOLS__'] = JSON.stringify(!isProduction);

        try {
            let vuePkg;
            try {
                vuePkg = require('rollup-plugin-vue');
            } catch (e) {
                if (e.code === 'ERR_REQUIRE_ESM') {
                    vuePkg = await import('rollup-plugin-vue');
                } else {
                    throw e;
                }
            }

            const vueFactory = vuePkg.default || vuePkg;
            if (typeof vueFactory === 'function') {
                vuePlugin = vueFactory({
                    compilerOptions: {
                        isCustomElement: (tag) => tag.includes('-')
                    }
                });
            }
        } catch (e) {
            Console.warn("Vue detected but failed to load rollup-plugin-vue:", e.message);
        }
    }

    let extensions = ['.mjs', '.js', '.json', '.node', '.jsx', '.tsx', '.ts'];
    if (hasVue) {
        extensions = ['.vue', ...extensions];
    }

    // REGEX ESSENCIAL: Permite que o ESBuild processe os arquivos virtuais do Vue
    let esbuildInclude;
    if (hasVue) {
        esbuildInclude = /\.[jt]sx?$|\.vue\?vue.*lang\.ts/;
    } else {
        esbuildInclude = /\.[jt]sx?$/;
    }

    const esbuildLoaders = {
        '.js': 'jsx',
        '.ts': 'ts',
        '.tsx': 'tsx',
        '.vue': 'ts'
    };

    return {
        input: entryPoint,
        external: nodeBuiltIns,
        treeshake: {
            moduleSideEffects: 'no-external',
            preset: isProduction ? 'recommended' : 'smallest'
        },

        cache: isProduction ? true : false,
        perf: false,
        maxParallelFileOps: 20,

        plugins: [
            replace({
                preventAssignment: true,
                values: replaceValues
            }),

            tsconfigPathsPlugin(process.cwd()),

            {
                name: 'block-volar-artifacts',
                load(id) {
                    if (/\.vue\.(js|ts|d\.ts|map)$/.test(id)) {
                        return 'export default {};';
                    }
                    return null;
                }
            },

            {
                name: 'block-vue-artifacts',
                load(id) {
                    if (!hasVue && (id.endsWith('.vue') || id.endsWith('.vue.js'))) {
                        return 'export default {};';
                    }
                    return null;
                }
            },

            nodeResolve({
                extensions,
                preferBuiltins: true,
                browser: true,
                dedupe: hasReact ? ['react', 'react-dom'] : (hasVue ? ['vue'] : [])
            }),

            ...(hasVue && vuePlugin ? [vuePlugin] : []),

            // AQUI ESTÁ A MÁGICA: Plugin que corrige a falta do export default
            ...(hasVue ? [vueScriptFixPlugin()] : []),

            commonjs({
                sourceMap: !isProduction,
                requireReturnsDefault: 'auto',
                ignoreTryCatch: true
            }),

            markdownPlugin(),

            customPostCssPlugin(isProduction),
            smartAssetPlugin(isProduction),
            jsonPlugin(),

            esbuild({
                include: esbuildInclude,
                exclude: /node_modules/,
                sourceMap: !isProduction,
                minify: isProduction,
                legalComments: 'none',
                treeShaking: isProduction,
                target: 'esnext',
                jsx: 'automatic',
                define: { __VERSION__: '"1.0.0"' },
                loaders: esbuildLoaders
            })
        ],
        onwarn(warning, warn) {
            if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
            if (warning.code === 'THIS_IS_UNDEFINED') return;
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
        const inputOptions = await createRollupConfig(entryPoint, outdir, isProduction);

        const outputOptions = {
            dir: outdir,
            format: 'es',
            entryFileNames: isProduction ? 'main-[hash].js' : 'main.js',
            chunkFileNames: 'chunks/[name]-[hash].js',
            assetFileNames: 'assets/[name]-[hash][extname]',
            sourcemap: !isProduction,
            compact: isProduction,

            manualChunks(id) {
                if (id.includes('node_modules')) {
                    const normalizedId = id.replace(/\\/g, '/');

                    if (/\/node_modules\/(react|react-dom|scheduler|prop-types|loose-envify|object-assign)\//.test(normalizedId)) {
                        return 'vendor-react';
                    }
                    if (/\/node_modules\/(vue|@vue)\//.test(normalizedId)) {
                        return 'vendor-vue';
                    }

                    if (id.includes('framer-motion') || id.includes('@radix-ui') || id.includes('@headlessui')) {
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
        const inputOptions = await createRollupConfig(entryPoint, outdir, isProduction);
        const outputOptions = {
            file: outfile,
            format: 'iife',
            name: 'Vattsjs',
            sourcemap: !isProduction,
            inlineDynamicImports: true,
            compact: true
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
        const inputOptions = await createRollupConfig(entryPoint, outdir, false);

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
        const inputOptions = await createRollupConfig(entryPoint, outdir, false);

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

        for (const item of items) {
            if (excludes.includes(item)) continue;
            const itemPath = path.join(dirPath, item);
            try {
                const info = await stat(itemPath);
                await rm(itemPath, { recursive: info.isDirectory(), force: true });
            } catch (e) {
                // Ignora erro se arquivo sumir
            }
        }
    } catch (e) {
        Console.warn(`Warning cleaning directory: ${e.message}`);
    }
}

module.exports = { build, watch, buildWithChunks, watchWithChunks };