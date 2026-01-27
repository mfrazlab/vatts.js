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
        'process.env.PORT': JSON.stringify(process.vatts?.port || 3000)
    };

    const extensions = ['.mjs', '.js', '.json', '.node', '.jsx', '.tsx', '.ts'];

    const esbuildLoaders = {
        '.js': 'jsx',
        '.ts': 'ts',
        '.tsx': 'tsx'
    };

    return {
        input: entryPoint,
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

            ...prePlugins,

            nodeResolve({
                extensions,
                preferBuiltins: true,
                browser: true,
                dedupe: ['react', 'react-dom']
            }),

            commonjs({
                sourceMap: !isProduction,
                requireReturnsDefault: 'auto',
                ignoreTryCatch: true
            }),

            ...postPlugins,

            jsonPlugin(),

            esbuild({
                include: /\.[jt]sx?$/,
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

module.exports = { createReactConfig };