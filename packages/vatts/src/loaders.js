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

const fs = require('fs');
const path = require('path');
const Module = require('module');
const {
    loadTsConfigPaths,
    resolveTsConfigAlias,
    resolveWithNodeStyleExtensions
} = require('./tsconfigPaths');

/**
 * Carrega e processa o tsconfig.json para obter os aliases
 */
function loadTsConfigAliases(projectDir = process.cwd()) {
    const info = loadTsConfigPaths(projectDir);

    // Mantém compat com a assinatura antiga (objeto alias->path),
    // mas agora com suporte real a wildcards.
    const aliases = {};
    for (const m of info.mappings || []) {
        // Apenas mapeamentos "prefixo" fáceis de representar (ex: "@/*")
        // continuam disponíveis aqui. A resolução completa é feita via resolveTsConfigAlias.
        if (m.hasStar && m.keySuffix === '' && m.targetHasStar && m.targetSuffix === '') {
            const cleanAlias = m.keyPrefix.replace(/\/$/, '');
            const cleanTarget = path.resolve(m.baseUrl, m.targetPrefix.replace(/\/$/, ''));
            if (cleanAlias) aliases[cleanAlias] = cleanTarget;
        } else if (!m.hasStar) {
            aliases[m.key] = path.resolve(m.baseUrl, m.target);
        }
    }

    return { aliases, info };
}

/**
 * Registra loaders customizados para Node.js
 * Permite importar arquivos não-JS diretamente no servidor
 */
function registerLoaders(options = {}) {
    // Registra resolver de aliases do tsconfig.json
    const projectDir = options.projectDir || process.cwd();
    const { aliases, info: tsconfigInfo } = loadTsConfigAliases(projectDir);

    if (Object.keys(aliases).length > 0 || (tsconfigInfo.mappings && tsconfigInfo.mappings.length > 0)) {
        // Guarda referência ao _resolveFilename atual (pode já ter sido modificado por source-map-support)
        const originalResolveFilename = Module._resolveFilename;

        Module._resolveFilename = function (request, parent, isMain, options) {
            // 1) Tenta resolver via paths do tsconfig (com wildcard)
            const aliasCandidate = resolveTsConfigAlias(request, tsconfigInfo);
            if (aliasCandidate) {
                const resolved = resolveWithNodeStyleExtensions(aliasCandidate);
                if (resolved) {
                    request = resolved;
                    return originalResolveFilename.call(this, request, parent, isMain, options);
                }
            }

            // 2) Fallback: compat com aliases simples (prefix match)
            for (const [alias, aliasPath] of Object.entries(aliases)) {
                if (request === alias || request.startsWith(alias + '/')) {
                    const relativePath = request.slice(alias.length);
                    const resolvedPath = path.join(aliasPath, relativePath);

                    const resolved = resolveWithNodeStyleExtensions(resolvedPath);
                    if (resolved) {
                        request = resolved;
                        break;
                    }
                }
            }

            // Chama o resolver original (que pode ser do source-map-support)
            return originalResolveFilename.call(this, request, parent, isMain, options);
        };
    }

    // Loader para arquivos Markdown (.md)
    require.extensions['.md'] = function (module, filename) {
        const content = fs.readFileSync(filename, 'utf8');
        module.exports = content;
    };

    // Loader para arquivos de texto (.txt)
    require.extensions['.txt'] = function (module, filename) {
        const content = fs.readFileSync(filename, 'utf8');
        module.exports = content;
    };

    // Loader para estilos (CSS e afins)
    // No servidor, estilos não são executados. Exportamos o caminho do arquivo para manter consistência com assets.
    const styleExtensions = ['.css', '.scss', '.sass', '.less'];
    styleExtensions.forEach(ext => {
        require.extensions[ext] = function (module, filename) {
            module.exports = filename;
        };
    });

    // Loader para arquivos JSON (já existe nativamente, mas garantimos consistência)
    // require.extensions['.json'] já existe

    // Loader para imagens - retorna o caminho do arquivo
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.bmp', '.svg'];

    imageExtensions.forEach(ext => {
        require.extensions[ext] = function (module, filename) {
            // No servidor, retornamos o caminho do arquivo
            // O frontend usará o plugin do esbuild para converter em base64
            module.exports = filename;
        };
    });
}

module.exports = { registerLoaders };

