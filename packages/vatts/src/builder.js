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
const { rollup, watch: rollupWatch } = require('rollup');
const path = require('path');
const Console = require("./api/console").default;
const fs = require('fs');
const crypto = require('crypto');
const { readdir, stat, rm, rename, readFile } = require("node:fs/promises");
const { loadTsConfigPaths, resolveTsConfigAlias } = require('./tsconfigPaths');
const { config } = require("./helpers")
// --- Optimization Plugins ---
let terser, replace;
try {
    terser = require('@rollup/plugin-terser');
    replace = require('@rollup/plugin-replace');
} catch (e) {
    Console.warn("Optimization plugins (@rollup/plugin-terser, @rollup/plugin-replace) not found. Build will be larger.");
}

// Import Framework specific builders
const { createReactConfig } = require('./react/react.build');
const { createVueConfig } = require('./vue/vue.build');


const excludedFiles = ['vatts.sock'];


// --- Virtual Entry Plugin ---
const virtualEntryPlugin = (options) => {
    const { routes, layout, notFound, framework } = options;
    const virtualEntryId = 'virtual:vatts-entry';
    const resolvedEntryId = '\0' + virtualEntryId;

    return {
        name: 'vatts-virtual-entry',
        resolveId(id) {
            if (id === virtualEntryId) {
                return resolvedEntryId;
            }
            return null;
        },
        load(id) {
            if (id === resolvedEntryId) {
                // Generate imports for routes
                const imports = routes
                    .map((route, index) => {
                        const componentPath = route.componentPath.replace(/\\/g, '/');
                        return `import route${index} from '${componentPath}';`;
                    })
                    .join('\n');

                // Generate layout import
                const layoutImport = layout
                    ? `import LayoutComponent from '${layout.componentPath.replace(/\\/g, '/')}';`
                    : '';

                // Generate NotFound import
                const notFoundImport = notFound
                    ? `import NotFoundComponent from '${notFound.componentPath.replace(/\\/g, '/')}';`
                    : '';

                // Determine default Not Found path (internal to Vatts)
                // We use absolute path to be safe
                // [FIX] Removido 'dist' extra do caminho. O __dirname já aponta para a dist quando compilado.
                const defaultNotFoundFilename = framework === 'vue' ? 'DefaultNotFound.vue' : 'DefaultNotFound.js';
                const defaultNotFoundPath = path.join(__dirname, framework, defaultNotFoundFilename).replace(/\\/g, '/');

                // Component Registration Logic
                let componentRegistration = routes
                    .map((route, index) => {
                        const key = route.componentPath.replace(/\\/g, '/');
                        return `  '${key}': route${index} || route${index}.default,`;
                    })
                    .join('\n');

                const layoutRegistration = layout
                    ? `window.__VATTS_LAYOUT__ = LayoutComponent.default || LayoutComponent;`
                    : `window.__VATTS_LAYOUT__ = null;`;

                const notFoundRegistration = notFound
                    ? `window.__VATTS_NOT_FOUND__ = NotFoundComponent.default || NotFoundComponent;`
                    : `window.__VATTS_NOT_FOUND__ = null;`;

                // Framework Client Entry
                // [FIX] Removido 'dist' extra do caminho.
                const entryClientFilename = 'entry.client.js';
                const entryClientPath = path.join(__dirname, framework, entryClientFilename).replace(/\\/g, '/');

                return `// Arquivo gerado virtualmente pelo vatts
${imports}
${layoutImport}
${notFoundImport}
import DefaultNotFound from '${defaultNotFoundPath}';

window.__VATTS_COMPONENTS__ = {
${componentRegistration}
};

${layoutRegistration}
${notFoundRegistration}

window.__VATTS_DEFAULT_NOT_FOUND__ = DefaultNotFound;

import '${entryClientPath}';
`;
            }
            return null;
        }
    };
};

// --- Common Plugins Definitions ---

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

const customPostCssPlugin = (isProduction, isWatch = false) => {
    let cachedProcessor = null;
    let configLoaded = false;

    const initPostCss = async (projectDir) => {
        // [FIX] Se estiver em modo Watch, NÃO retorna o processador cacheado.
        // Isso força o PostCSS/Tailwind a reinicializar e escanear os arquivos novamente
        // para encontrar classes novas (JIT/Arbitrary values).
        if (configLoaded && !isWatch) return cachedProcessor;

        process.env.NODE_ENV = isProduction ? 'production' : 'development';
        const postcssConfigPath = path.join(projectDir, 'postcss.config.js');
        const postcssConfigMjsPath = path.join(projectDir, 'postcss.config.mjs');
        const configPath = fs.existsSync(postcssConfigPath) ? postcssConfigPath :
            (fs.existsSync(postcssConfigMjsPath) ? postcssConfigMjsPath : null);

        if (configPath) {
            try {
                let postcss;
                try { postcss = require(path.join(projectDir, 'node_modules', 'postcss')); }
                catch { try { postcss = require('postcss'); } catch (e) { return null; } }

                if (postcss) {
                    // Limpa o cache do require para garantir que a config seja lida novamente se editada (opcional, mas seguro)
                    delete require.cache[require.resolve(configPath)];

                    const config = require(configPath);
                    const postcssConfig = config.default || config;
                    const plugins = [];
                    if (postcssConfig.plugins) {
                        if (Array.isArray(postcssConfig.plugins)) {
                            plugins.push(...postcssConfig.plugins.map(p => {
                                if (typeof p === 'string') {
                                    try { return require(require.resolve(p, { paths: [projectDir] })); }
                                    catch { return require(p); }
                                }
                                return p;
                            }));
                        } else {
                            for (const [name, options] of Object.entries(postcssConfig.plugins)) {
                                try {
                                    const resolvedPath = require.resolve(name, { paths: [projectDir] });
                                    plugins.push(require(resolvedPath)(options || {}));
                                } catch (e) { Console.warn(`Unable to load plugin ${name}:`, e.message); }
                            }
                        }
                    }
                    cachedProcessor = postcss(plugins);
                }
            } catch (e) { Console.warn(`Error initializing PostCSS:`, e.message); }
        }
        configLoaded = true;
        return cachedProcessor;
    };

    return {
        name: 'custom-postcss-plugin',
        // [FIX] Hook load adicionado para modo watch.
        // Ele lê o CSS e injeta um comentário com timestamp. Isso faz o Rollup pensar que o arquivo mudou,
        // forçando a execução do transform(), que por sua vez roda o Tailwind novamente.
        async load(id) {
            if (isWatch && id.endsWith('.css')) {
                try {
                    const content = await readFile(id, 'utf8');
                    // Injeta comentário para invalidar cache do Rollup para este arquivo
                    return content + `\n/* v-watch-${Date.now()} */`;
                } catch (e) {
                    return null; // Deixa o Rollup carregar normalmente se falhar
                }
            }
            return null; // Comportamento padrão para build normal ou outros arquivos
        },
        async transform(code, id) {
            if (!id.endsWith('.css')) return null;

            if (isWatch) {
                this.addWatchFile(id);
            }

            const processor = await initPostCss(process.cwd());
            let processedCss = code;

            if (processor) {
                try {
                    // Sempre passa o 'from' para que o Tailwind saiba onde está o arquivo
                    const result = await processor.process(code, { from: id, to: id, map: false });
                    processedCss = result.css;
                } catch (e) { Console.warn(`PostCSS process error:`, e.message); }
            }

            const hash = crypto.createHash('md5').update(id).digest('hex').slice(0, 8);
            const baseName = path.basename(id).split('?')[0];
            const uniqueName = `${hash}-${baseName}`;

            const safeId = uniqueName.replace(/[^a-zA-Z0-9-_]/g, '_');
            const referenceId = this.emitFile({ type: 'asset', name: uniqueName, source: processedCss });

            return {
                code: `
                const cssUrl = String(import.meta.ROLLUP_FILE_URL_${referenceId});
                if (typeof document !== 'undefined') {
                    const linkId = 'vatts-css-' + "${safeId}";
                    let link = document.getElementById(linkId);
                    
                    if (!link) {
                        link = document.createElement('link');
                        link.id = linkId;
                        link.rel = 'stylesheet';
                        document.head.appendChild(link);
                    }
                    
                    const timestamp = ${isWatch ? 'Date.now()' : 'null'};
                    link.href = timestamp ? (cssUrl + '?t=' + timestamp) : cssUrl;
                }
                export default cssUrl;
            `,
                map: { mappings: '' }
            };
        }
    };
};

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

            const hash = crypto.createHash('md5').update(cleanId).digest('hex').slice(0, 8);
            const baseName = path.basename(cleanId);
            const uniqueName = `${hash}-${baseName}`;

            if (type === 'svg') {
                if (size < INLINE_LIMIT) {
                    const content = buffer.toString('utf8');
                    const base64 = buffer.toString('base64');
                    return `
                        export default "data:image/svg+xml;base64,${base64}";
                        export const svgContent = ${JSON.stringify(content)};
                    `;
                } else {
                    const referenceId = this.emitFile({ type: 'asset', name: uniqueName, source: buffer });
                    const content = buffer.toString('utf8');
                    return `
                        export default String(import.meta.ROLLUP_FILE_URL_${referenceId});
                        export const svgContent = ${JSON.stringify(content)};
                    `;
                }
            }

            if (size < INLINE_LIMIT) {
                const base64 = buffer.toString('base64');
                return `export default "data:${type};base64,${base64}";`;
            } else {
                const referenceId = this.emitFile({ type: 'asset', name: uniqueName, source: buffer });
                return `export default String(import.meta.ROLLUP_FILE_URL_${referenceId});`;
            }
        }
    };
};

const nodeBuiltIns = [
    'assert', 'buffer', 'child_process', 'cluster', 'crypto', 'dgram', 'dns',
    'domain', 'events', 'fs', 'http', 'https', 'net', 'os', 'path', 'punycode',
    'querystring', 'readline', 'stream', 'string_decoder', 'tls', 'tty', 'url',
    'util', 'v8', 'vm', 'zlib', 'module', 'worker_threads', 'perf_hooks'
];

// --- Optimization Logic ---

function getOptimizationPlugins(isProduction) {
    const plugins = [];
    const env = isProduction ? 'production' : 'development';

    if (replace) {
        plugins.push(replace({
            'process.env.NODE_ENV': JSON.stringify(env),
            'process.env': JSON.stringify({ NODE_ENV: env }),
            'process.browser': 'true',
            preventAssignment: true,
            objectGuards: true
        }));
    }

    if (isProduction && terser) {
        plugins.push(terser({
            ecma: 2020,
            module: true,
            toplevel: true,
            compress: {
                passes: 3,
                pure_getters: true,
                unsafe: true,
                unsafe_arrows: true,
                unsafe_methods: true,
                unsafe_proto: true,
                booleans_as_integers: true,
                drop_console: true,
                drop_debugger: true,
                keep_fargs: false,
                hoist_funs: true,
                hoist_vars: true,
                reduce_funcs: true,
                reduce_vars: true,
                pure_funcs: ['console.info', 'console.debug', 'console.warn', 'console.log', 'Object.freeze']
            },
            mangle: {
                properties: false,
                toplevel: true,
            },
            format: {
                comments: false,
                wrap_func_args: false,
            }
        }));
    }

    return plugins;
}

// --- Core Logic ---

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

async function getFrameworkConfig(vattsOptions, outdir, isProduction, isWatch = false) {
    // Determine framework from options or detect
    const projectDir = vattsOptions.projectDir || process.cwd();
    const framework = vattsOptions.framework || detectFramework(projectDir);

    // Ensure framework is in options for plugin
    vattsOptions.framework = framework;
    vattsOptions.projectDir = projectDir;

    const prePlugins = [
        virtualEntryPlugin(vattsOptions), // Add Virtual Entry Plugin
        tsconfigPathsPlugin(projectDir),
        {
            name: 'block-vue-artifacts-generic',
            load(id) {
                if (framework !== 'vue' && (id.endsWith('.vue') || id.endsWith('.vue.js'))) {
                    return 'export default {};';
                }
                return null;
            }
        }
    ];

    const postPlugins = [
        markdownPlugin(),
        customPostCssPlugin(isProduction, isWatch),
        smartAssetPlugin(isProduction)
    ];

    const pluginConfig = { prePlugins, postPlugins };
    let config;

    // Use virtual entry ID
    const entryPoint = 'virtual:vatts-entry';

    if (framework === 'vue') {
        config = await createVueConfig(entryPoint, outdir, isProduction, pluginConfig);
    } else {
        config = await createReactConfig(entryPoint, outdir, isProduction, pluginConfig);
    }

    return config;
}

// --- Build Functions ---

// Refactored to accept vattsOptions instead of entryPoint
async function buildWithChunks(vattsOptions, outdir, isProduction = false) {
    await cleanDirectoryExcept(outdir, excludedFiles);

    try {
        const inputOptions = await getFrameworkConfig(vattsOptions, outdir, isProduction, false);
        inputOptions.external = nodeBuiltIns;

        if (isProduction) {
            inputOptions.treeshake = {
                preset: 'smallest',
                moduleSideEffects: (id) => !id.includes('node_modules') || id.endsWith('.css') || id.includes('entry.client'),
                propertyReadSideEffects: false,
                tryCatchDeoptimization: false
            };
        }

        const optimizationPlugins = getOptimizationPlugins(isProduction);
        const replacePlugin = optimizationPlugins.find(p => p.name === 'replace');
        const otherPlugins = optimizationPlugins.filter(p => p.name !== 'replace');

        if (replacePlugin) inputOptions.plugins.unshift(replacePlugin);
        inputOptions.plugins.push(...otherPlugins);

        const processPolyfill = `var process = { env: { NODE_ENV: "${isProduction ? 'production' : 'development'}" } };`;

        const outputOptions = {
            dir: outdir,
            format: 'es',
            entryFileNames: isProduction ? 'main.[hash].js' : 'main.js',
            chunkFileNames: 'chunks/[name].[hash].js',
            assetFileNames: 'assets/[name].[hash][extname]',
            sourcemap: !isProduction,
            compact: isProduction,
            intro: processPolyfill,
            manualChunks(id) {
                if (id.includes('node_modules')) {
                    const normalizedId = id.replace(/\\/g, '/');

                    if (/\/node_modules\/vue-router\//.test(normalizedId)) return 'vendor-vue-router';
                    if (/\/node_modules\/(pinia|vuex)\//.test(normalizedId)) return 'vendor-vue-store';

                    if (/\/node_modules\/(vue|@vue)\//.test(normalizedId)) {
                        if (normalizedId.includes('/runtime-core')) return 'vendor-vue-runtime-core';
                        if (normalizedId.includes('/runtime-dom')) return 'vendor-vue-runtime-dom';
                        if (normalizedId.includes('/reactivity')) return 'vendor-vue-reactivity';
                        if (normalizedId.includes('/shared')) return 'vendor-vue-shared';
                        if (normalizedId.includes('/compiler-')) return 'vendor-vue-compiler';
                        return 'vendor-vue-core';
                    }

                    if (/\/node_modules\/react-dom\//.test(normalizedId)) return 'vendor-react-dom';
                    if (/\/node_modules\/scheduler\//.test(normalizedId)) return 'vendor-react-scheduler';
                    if (/\/node_modules\/react-router/.test(normalizedId)) return 'vendor-react-router';
                    if (/\/node_modules\/react\//.test(normalizedId)) return 'vendor-react-core';

                    if (id.includes('framer-motion')) return 'vendor-framer';
                    if (id.includes('@radix-ui')) return 'vendor-radix';
                    if (id.includes('@headlessui')) return 'vendor-headless';
                    if (id.includes('@heroicons')) return 'vendor-icons';

                    if (id.includes('lodash')) return 'vendor-lodash';
                    if (id.includes('date-fns') || id.includes('moment')) return 'vendor-date';
                    if (id.includes('axios')) return 'vendor-axios';

                    return 'vendor-libs';
                }
            }
        };

        const bundle = await rollup(inputOptions);
        await bundle.write(outputOptions);
        await bundle.close();

        if (isProduction) {
            try {
                const { runOptimizer } = require('./api/optimizer');
                const optimizedDir = path.join(outdir, 'optimized');

                runOptimizer({
                    targetDir: outdir,
                    outputDir: optimizedDir,
                    ignoredPatterns: ['assets'],
                });

                const rootFiles = await readdir(outdir);
                for (const file of rootFiles) {
                    if ((file.startsWith('main') && file.endsWith('.js')) || file === 'chunks') {
                        await rm(path.join(outdir, file), { recursive: true, force: true });
                    }
                }

                if (fs.existsSync(optimizedDir)) {
                    const optFiles = await readdir(optimizedDir);
                    for (const file of optFiles) {
                        const srcPath = path.join(optimizedDir, file);
                        const destPath = path.join(outdir, file);
                        await rm(destPath, { recursive: true, force: true });
                        await rename(srcPath, destPath);
                    }
                    await rm(optimizedDir, { recursive: true, force: true });
                }
                Console.log("✅ Build successfully optimized with native optimizer.");
            } catch (err) {
                Console.error('Native optimization failed:', err);
            }
        }

    } catch (error) {
        Console.error('An error occurred while building with chunks:', error);
        process.exit(1);
    }
}

async function build(vattsOptions, outfile, isProduction = false) {
    const outdir = path.dirname(outfile);
    await cleanDirectoryExcept(outdir, excludedFiles);

    try {
        const inputOptions = await getFrameworkConfig(vattsOptions, outdir, isProduction, false);
        inputOptions.external = nodeBuiltIns;

        if (isProduction) {
            inputOptions.treeshake = {
                preset: 'smallest',
                moduleSideEffects: (id) => !id.includes('node_modules') || id.endsWith('.css') || id.includes('entry.client'),
                propertyReadSideEffects: false
            };
        }

        const optimizationPlugins = getOptimizationPlugins(isProduction);
        const replacePlugin = optimizationPlugins.find(p => p.name === 'replace');
        const otherPlugins = optimizationPlugins.filter(p => p.name !== 'replace');

        if (replacePlugin) inputOptions.plugins.unshift(replacePlugin);
        inputOptions.plugins.push(...otherPlugins);

        const processPolyfill = `var process = { env: { NODE_ENV: "${isProduction ? 'production' : 'development'}" } };`;

        const outputOptions = {
            file: outfile,
            format: 'iife',
            name: 'Vattsjs',
            sourcemap: !isProduction,
            inlineDynamicImports: true,
            compact: true,
            annotations: true,
            intro: processPolyfill
        };

        const bundle = await rollup(inputOptions);
        await bundle.write(outputOptions);
        await bundle.close();

    } catch (error) {
        Console.error('An error occurred during build:', error);
        process.exit(1);
    }
}

function handleWatcherEvents(watcher, hotReloadManager, resolveFirstBuild) {
    let currentBuildId = 0;
    let lastStartedBuildId = 0;
    const erroredBuildIds = new Set();

    watcher.on('event', async event => {
        if (event.code === 'START') {
            currentBuildId += 1;
            lastStartedBuildId = currentBuildId;
            if (global.gc) { try { global.gc(); } catch (e) {} }
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
            if (hotReloadManager) hotReloadManager.onBuildComplete(false, errDetails);
            else Console.error("Build Error:", event.error);
            if (resolveFirstBuild) resolveFirstBuild();
        }
        if (event.code === 'BUNDLE_END') await event.result.close();
        if (event.code === 'END') {
            const endBuildId = currentBuildId;
            const hadError = erroredBuildIds.has(endBuildId);
            if (endBuildId === lastStartedBuildId && !hadError) {
                if (hotReloadManager) hotReloadManager.onBuildComplete(true, { buildId: endBuildId });
            }
            for (const id of erroredBuildIds) if (id < lastStartedBuildId) erroredBuildIds.delete(id);
            if (resolveFirstBuild) { resolveFirstBuild(); resolveFirstBuild = null; }
        }
    });
}

async function watchWithChunks(vattsOptions, outdir, hotReloadManager = null) {
    await cleanDirectoryExcept(outdir, excludedFiles);
    try {
        const inputOptions = await getFrameworkConfig(vattsOptions, outdir, false, true);
        inputOptions.external = nodeBuiltIns;

        const optimizationPlugins = getOptimizationPlugins(false);
        inputOptions.plugins = [...inputOptions.plugins, ...optimizationPlugins];

        const processPolyfill = `var process = { env: { NODE_ENV: "development" } };`;

        const outputOptions = {
            dir: outdir,
            format: 'es',
            entryFileNames: 'main.js',
            assetFileNames: 'assets/[name][extname]',
            sourcemap: true,
            intro: processPolyfill
        };

        // Correcting the watch options syntax
        const watchOptions = {
            ...inputOptions,
            output: outputOptions,
            watch: {
                exclude: ['node_modules/**', path.join(outdir, '**').replace(/\\/g, '/')],
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

async function watch(vattsOptions, outfile, hotReloadManager = null) {
    const outdir = path.dirname(outfile);
    try {
        const inputOptions = await getFrameworkConfig(vattsOptions, outdir, false, true);
        inputOptions.external = nodeBuiltIns;

        const optimizationPlugins = getOptimizationPlugins(false);
        inputOptions.plugins = [...inputOptions.plugins, ...optimizationPlugins];

        const processPolyfill = `var process = { env: { NODE_ENV: "development" } };`;

        const outputOptions = {
            file: outfile,
            format: 'es',
            assetFileNames: 'assets/[name][extname]',
            sourcemap: true,
            intro: processPolyfill
        };

        // Correcting the watch options syntax
        const watchOptions = {
            ...inputOptions,
            output: outputOptions,
            watch: {
                exclude: ['node_modules/**', path.join(outdir, '**').replace(/\\/g, '/')],
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

async function cleanDirectoryExcept(dirPath, excludeItems) {
    try {
        if (!fs.existsSync(dirPath)) return;
        // Transforma em array para suportar um ou vários itens (arquivos ou pastas)
        const excludes = Array.isArray(excludeItems) ? excludeItems : [excludeItems];
        const items = await readdir(dirPath);

        for (const item of items) {
            // Verifica se o nome do arquivo ou pasta está na lista de exclusão
            if (excludes.includes(item)) continue;

            const itemPath = path.join(dirPath, item);
            try {
                const info = await stat(itemPath);
                await rm(itemPath, { recursive: info.isDirectory(), force: true });
            } catch (e) {}
        }
    } catch (e) {
        Console.warn(`Warning cleaning directory: ${e.message}`);
    }
}

module.exports = { build, watch, buildWithChunks, watchWithChunks };