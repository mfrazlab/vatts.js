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

const nodeResolve = require('@rollup/plugin-node-resolve').default;
const commonjs = require('@rollup/plugin-commonjs').default;
const replace = require('@rollup/plugin-replace').default;
const esbuild = require('rollup-plugin-esbuild').default;
const jsonPlugin = require("@rollup/plugin-json").default;
const Console = require("../api/console").default;

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
                if (!code.includes('export default')) {
                    return {
                        code: code + '\nexport default {};',
                        map: null
                    };
                }
            }
            return null;
        }
    };
};

/**
 * Cria a configuração do Rollup otimizada para Vue
 * @param {string} entryPoint - Arquivo de entrada
 * @param {string} outdir - Diretório de saída
 * @param {boolean} isProduction - Flag de produção
 * @param {Object} plugins - Objeto contendo arrays de plugins
 * @param {Array} plugins.prePlugins - Plugins para rodar ANTES do framework (TSConfig, etc)
 * @param {Array} plugins.postPlugins - Plugins para rodar DEPOIS do framework (CSS, Assets, Markdown)
 */
async function createVueConfig(entryPoint, outdir, isProduction, { prePlugins = [], postPlugins = [] } = {}) {

    const replaceValues = {
        'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
        'process.env.PORT': JSON.stringify(process.vatts?.port || 3000),
        '__VUE_OPTIONS_API__': JSON.stringify(true),
        '__VUE_PROD_DEVTOOLS__': JSON.stringify(!isProduction),
        preventAssignment: true
    };

    let vuePlugin = null;
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
                // [OPTIMIZATION] Informa explicitamente que é produção para otimizações internas do Vue
                isProduction: isProduction,
                compilerOptions: {
                    isCustomElement: (tag) => tag.includes('-'),
                    // [FIX] Remove comentários HTML (<!-- ... -->) do template compilado
                    comments: false
                }
            });
        }
    } catch (e) {
        Console.warn("Vue detected but failed to load rollup-plugin-vue:", e.message);
    }

    const extensions = ['.vue', '.mjs', '.js', '.json', '.node', '.jsx', '.tsx', '.ts'];

    const esbuildLoaders = {
        '.js': 'jsx',
        '.ts': 'ts',
        '.tsx': 'tsx',
        '.vue': 'ts'
    };

    return {
        input: entryPoint,
        // [OPTIMIZATION] Preset 'smallest' é o mais agressivo do Rollup
        treeshake: {
            moduleSideEffects: 'no-external',
            preset: isProduction ? 'smallest' : 'recommended',
            propertyReadSideEffects: false,
            tryCatchDeoptimization: false
        },
        cache: isProduction ? true : false,
        perf: false,
        maxParallelFileOps: 20,

        plugins: [
            replace(replaceValues),

            // Plugins de Infra (TSConfig, etc)
            ...prePlugins,

            {
                name: 'block-volar-artifacts',
                load(id) {
                    if (/\.vue\.(js|ts|d\.ts|map)$/.test(id)) {
                        return 'export default {};';
                    }
                    return null;
                }
            },

            nodeResolve({
                extensions,
                preferBuiltins: true,
                browser: true,
                dedupe: ['vue']
            }),

            // Vue Plugin processa os arquivos .vue aqui
            ...(vuePlugin ? [vuePlugin] : []),
            vueScriptFixPlugin(),

            commonjs({
                sourceMap: !isProduction,
                // [FIX] 'preferred' ajuda o Rollup a escolher o export default correto para Vue/Libs
                requireReturnsDefault: 'preferred',
                ignoreTryCatch: true,
                transformMixedEsModules: true,
                esmExternals: false // Garante que deps CommonJS sejam empacotadas
            }),

            // Plugins de Assets/CSS rodam DEPOIS do Vue ter gerado os arquivos virtuais de estilo
            ...postPlugins,

            jsonPlugin({
                compact: true
            }),

            esbuild({
                include: /\.[jt]sx?$|\.vue\?vue.*lang\.ts/,
                exclude: /node_modules/,
                sourceMap: !isProduction,
                // [OPTIMIZATION] Mantemos false aqui pois o Terser (no bundler principal) fará o trabalho pesado
                minify: false,
                legalComments: 'none',
                treeShaking: true,
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

module.exports = { createVueConfig };