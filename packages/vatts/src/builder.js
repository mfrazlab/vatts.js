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
const { readdir, stat, rm } = require("node:fs/promises");
const { loadTsConfigPaths, resolveTsConfigAlias } = require('./tsconfigPaths');

// Import Framework specific builders
const { createReactConfig } = require('./react/react.build');
const { createVueConfig } = require('./vue/vue.build');

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
                try { postcss = require(path.join(projectDir, 'node_modules', 'postcss')); }
                catch { try { postcss = require('postcss'); } catch (e) { return null; } }

                if (postcss) {
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
        async transform(code, id) {
            if (!id.endsWith('.css')) return null;
            const processor = await initPostCss(process.cwd());
            let processedCss = code;
            if (processor) {
                try {
                    const result = await processor.process(code, { from: id, to: id, map: false });
                    processedCss = result.css;
                } catch (e) { Console.warn(`PostCSS process error:`, e.message); }
            }
            const cleanName = path.basename(id).split('?')[0];
            const referenceId = this.emitFile({ type: 'asset', name: cleanName, source: processedCss });
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
                    return `
                        export default "data:image/svg+xml;base64,${base64}";
                        export const svgContent = ${JSON.stringify(content)};
                    `;
                } else {
                    const referenceId = this.emitFile({ type: 'asset', name: path.basename(cleanId), source: buffer });
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
                const referenceId = this.emitFile({ type: 'asset', name: path.basename(cleanId), source: buffer });
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

async function getFrameworkConfig(entryPoint, outdir, isProduction) {
    const framework = detectFramework();

    // Plugins que rodam ANTES da resolução de módulos (Configuração, Bloqueios de Framework incorreto)
    const prePlugins = [
        tsconfigPathsPlugin(process.cwd()),
        {
            name: 'block-vue-artifacts-generic',
            load(id) {
                // Se não for vue, bloqueia artifacts. O build.vue lida com o inverso.
                if (framework !== 'vue' && (id.endsWith('.vue') || id.endsWith('.vue.js'))) {
                    return 'export default {};';
                }
                return null;
            }
        }
    ];

    // Plugins que rodam DEPOIS da transformação do Framework (Markdown, CSS, Assets)
    // Isso é crucial para o Vue, pois o CSS é gerado dinamicamente e precisa ser pego aqui.
    const postPlugins = [
        markdownPlugin(),
        customPostCssPlugin(isProduction),
        smartAssetPlugin(isProduction)
    ];

    const pluginConfig = { prePlugins, postPlugins };

    if (framework === 'vue') {
        Console.info("Framework detected: Vue.js");
        return await createVueConfig(entryPoint, outdir, isProduction, pluginConfig);
    } else {
        Console.info("Framework detected: React/Standard");
        return await createReactConfig(entryPoint, outdir, isProduction, pluginConfig);
    }
}

// --- Build Functions ---

async function buildWithChunks(entryPoint, outdir, isProduction = false) {
    await cleanDirectoryExcept(outdir, 'temp');

    try {
        const inputOptions = await getFrameworkConfig(entryPoint, outdir, isProduction);
        inputOptions.external = nodeBuiltIns;

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
                    if (/\/node_modules\/(react|react-dom|scheduler|prop-types|loose-envify|object-assign)\//.test(normalizedId)) return 'vendor-react';
                    if (/\/node_modules\/(vue|@vue)\//.test(normalizedId)) return 'vendor-vue';
                    if (id.includes('framer-motion') || id.includes('@radix-ui') || id.includes('@headlessui')) return 'vendor-ui';
                    if (id.includes('lodash') || id.includes('date-fns') || id.includes('axios')) return 'vendor-utils';
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

async function build(entryPoint, outfile, isProduction = false) {
    const outdir = path.dirname(outfile);
    await cleanDirectoryExcept(outdir, 'temp');

    try {
        const inputOptions = await getFrameworkConfig(entryPoint, outdir, isProduction);
        inputOptions.external = nodeBuiltIns;

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

// --- Watch Functions ---

function handleWatcherEvents(watcher, hotReloadManager, resolveFirstBuild) {
    let currentBuildId = 0;
    let lastStartedBuildId = 0;
    const erroredBuildIds = new Set();

    watcher.on('event', event => {
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
        if (event.code === 'BUNDLE_END') event.result.close();
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

async function watchWithChunks(entryPoint, outdir, hotReloadManager = null) {
    await cleanDirectoryExcept(outdir, 'temp');
    try {
        const inputOptions = await getFrameworkConfig(entryPoint, outdir, false);
        inputOptions.external = nodeBuiltIns;

        const outputOptions = {
            dir: outdir,
            format: 'es',
            entryFileNames: 'main.js',
            sourcemap: true
        };
        const watchOptions = {
            ...inputOptions,
            output: outputOptions,
            watch: { exclude: 'node_modules/**', clearScreen: false, skipWrite: false, buildDelay: 100 }
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

async function watch(entryPoint, outfile, hotReloadManager = null) {
    const outdir = path.dirname(outfile);
    try {
        const inputOptions = await getFrameworkConfig(entryPoint, outdir, false);
        inputOptions.external = nodeBuiltIns;

        const outputOptions = {
            file: outfile,
            format: 'es',
            sourcemap: true
        };
        const watchOptions = {
            ...inputOptions,
            output: outputOptions,
            watch: { exclude: 'node_modules/**', clearScreen: false, buildDelay: 100 }
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
            } catch (e) {}
        }
    } catch (e) {
        Console.warn(`Warning cleaning directory: ${e.message}`);
    }
}

module.exports = { build, watch, buildWithChunks, watchWithChunks };