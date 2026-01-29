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

/**
 * Cria a configuração do Rollup otimizada para React
 * @param {string} entryPoint - Arquivo de entrada
 * @param {string} outdir - Diretório de saída
 * @param {boolean} isProduction - Flag de produção
 * @param {Object} plugins - Objeto contendo arrays de plugins
 * @param {Array} plugins.prePlugins - Plugins para rodar ANTES do framework
 * @param {Array} plugins.postPlugins - Plugins para rodar DEPOIS do framework
 */
async function createReactConfig(entryPoint, outdir, isProduction, { prePlugins = [], postPlugins = [] } = {}) {
    const replaceValues = {
        'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
        'process.env.PORT': JSON.stringify(process.vatts?.port || 3000),
        // [FIX] Define o hook do DevTools como um objeto vazio seguro caso não exista,
        // evitando o ReferenceError em builds de produção ou ambientes restritos.
        '__REACT_DEVTOOLS_GLOBAL_HOOK__': '({ isDisabled: true })',
        preventAssignment: true
    };

    const extensions = ['.mjs', '.js', '.json', '.node', '.jsx', '.tsx', '.ts'];

    const esbuildLoaders = {
        '.js': 'jsx',
        '.ts': 'ts',
        '.tsx': 'tsx'
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

            ...prePlugins,

            nodeResolve({
                extensions,
                preferBuiltins: true,
                browser: true,
                // [FIX] Apenas dedupe React principal para evitar conflitos, mas deixe libs internas resolverem
                dedupe: ['react', 'react-dom']
            }),

            commonjs({
                sourceMap: !isProduction,
                // [FIX] 'preferred' ajuda o Rollup a escolher o export default correto para React
                // Isso muitas vezes resolve o erro de "undefined reading createElement"
                requireReturnsDefault: 'preferred',
                ignoreTryCatch: true,
                transformMixedEsModules: true,
                esmExternals: false
            }),

            ...postPlugins,

            jsonPlugin({
                compact: true
            }),

            esbuild({
                include: /\.[jt]sx?$/,
                exclude: /node_modules/,
                sourceMap: !isProduction,
                // [OPTIMIZATION] Mantemos false aqui pois o Terser (no bundler principal) fará o trabalho pesado
                minify: false,
                legalComments: 'none',
                treeShaking: true,
                target: 'esnext',
                jsx: 'automatic',
                define: {
                    __VERSION__: '"1.0.0"',
                },
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

module.exports = { createReactConfig };