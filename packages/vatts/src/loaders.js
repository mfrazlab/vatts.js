/*
 * This file is part of the Vatts.js Project.
 * Copyright (c) 2026 mfraz
 */

const fs = require('fs');
const path = require('path');
const Module = require('module');
const { default: Console } = require("./api/console");

// Tenta carregar o compilador do Vue e o esbuild
let sfcCompiler;
let esbuild;

try {
    sfcCompiler = require('vue/compiler-sfc');
} catch (e) {
    // Vue não instalado ou não encontrado
}

try {
    esbuild = require('esbuild');
} catch (e) {
    // Esbuild não instalado
}

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

    const aliases = {};
    for (const m of info.mappings || []) {
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
 */
function registerLoaders(options = {}) {
    const projectDir = options.projectDir || process.cwd();
    const { aliases, info: tsconfigInfo } = loadTsConfigAliases(projectDir);

    // --- Alias Resolution (Path Mapping) ---
    if (Object.keys(aliases).length > 0 || (tsconfigInfo.mappings && tsconfigInfo.mappings.length > 0)) {
        const originalResolveFilename = Module._resolveFilename;

        Module._resolveFilename = function(request, parent, isMain, options) {
            const aliasCandidate = resolveTsConfigAlias(request, tsconfigInfo);
            if (aliasCandidate) {
                const resolved = resolveWithNodeStyleExtensions(aliasCandidate);
                if (resolved) {
                    request = resolved;
                    return originalResolveFilename.call(this, request, parent, isMain, options);
                }
            }

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
            return originalResolveFilename.call(this, request, parent, isMain, options);
        };
    }

    // --- File Handlers ---

    require.extensions['.md'] = function(module, filename) {
        const content = fs.readFileSync(filename, 'utf8');
        module.exports = content;
    };

    require.extensions['.txt'] = function(module, filename) {
        const content = fs.readFileSync(filename, 'utf8');
        module.exports = content;
    };

    const styleExtensions = ['.css', '.scss', '.sass', '.less'];
    styleExtensions.forEach(ext => {
        require.extensions[ext] = function(module, filename) {
            module.exports = filename;
        };
    });

    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.bmp', '.svg'];
    imageExtensions.forEach(ext => {
        require.extensions[ext] = function(module, filename) {
            module.exports = filename;
        };
    });

    // --- Loader Robusto para .vue (SSR Support) ---
    require.extensions['.vue'] = function(module, filename) {
        if (!sfcCompiler || !esbuild) {
            throw new Error('Para carregar arquivos .vue no servidor, você precisa instalar "vue" e "esbuild".');
        }

        const source = fs.readFileSync(filename, 'utf8');
        // Variável para armazenar o código final para fins de debug
        let finalEsm = '';

        try {
            // 1. Parse do SFC
            const { descriptor, errors } = sfcCompiler.parse(source, {
                filename,
                sourceMap: false
            });

            if (errors.length > 0) {
                console.error(`Erro ao parsear ${filename}:`, errors);
            }

            // 2. Compilação do Script (<script> ou <script setup>)
            // Padrão: Se não houver script, definimos um objeto vazio
            let scriptContent = 'const _sfc_main = {};';
            let bindings = undefined;

            if (descriptor.script || descriptor.scriptSetup) {
                try {
                    const compiledScript = sfcCompiler.compileScript(descriptor, {
                        id: filename,
                        isProd: false,
                        inlineTemplate: false
                    });

                    // Lógica de substituição corrigida para evitar dupla declaração
                    if (compiledScript.content.includes('const _sfc_main =')) {
                        // O compilador do Vue já declarou o _sfc_main (comum no script setup)
                        scriptContent = compiledScript.content;
                    } else if (compiledScript.content.match(/export\s+default/)) {
                        // Substitui export default tradicional
                        scriptContent = compiledScript.content.replace(/export\s+default/, 'const _sfc_main =');
                    } else {
                        // Se não achou export default e o Vue não declarou o _sfc_main, nós criamos um vazio
                        scriptContent = compiledScript.content + '\nconst _sfc_main = {};';
                    }

                    bindings = compiledScript.bindings;
                } catch (e) {
                    console.error(`Erro ao compilar script Vue em ${filename}:`, e.message);
                    throw e;
                }
            }

            // 3. Compilação do Template para SSR
            let templateContent = '';
            if (descriptor.template) {
                try {
                    const templateResult = sfcCompiler.compileTemplate({
                        source: descriptor.template.content,
                        filename: filename,
                        id: filename,
                        ssr: true,
                        compilerOptions: {
                            bindingMetadata: bindings
                        },
                        ssrCssVars: descriptor.cssVars || []
                    });
                    templateContent = templateResult.code;
                } catch (e) {
                    console.error(`Erro ao compilar template Vue em ${filename}:`, e.message);
                }
            }

            // 4. Montagem do Código Final (ESM Virtual)
            finalEsm = `
                ${scriptContent}
                ${templateContent}
                
                // Anexa a função de renderização SSR ao componente principal
                if (typeof _sfc_main !== 'undefined') {
                    if (typeof ssrRender !== 'undefined') {
                        _sfc_main.ssrRender = ssrRender;
                    }
                    if (typeof render !== 'undefined') {
                        _sfc_main.render = render;
                    }
                }
                
                export default _sfc_main;
            `;

            // 5. Transformação final para CommonJS (Node.js) via Esbuild
            const result = esbuild.transformSync(finalEsm, {
                loader: 'ts',
                format: 'cjs',
                target: 'node16',
                sourcefile: filename
            });

            // 6. Execução no Node
            module._compile(result.code, filename);

        } catch (err) {
            console.error(`\n--- Vatts Loader Debug ---`);
            console.error(`Falha fatal ao carregar: ${filename}`);
            console.error(`Erro original: ${err.message}`);
            if (finalEsm) {
                console.error(`\n[DEBUG] Código gerado (Snippet):`);
                console.error(finalEsm.split('\n').slice(0, 30).join('\n') + '\n...');
            }
            console.error(`--------------------------\n`);
            throw err;
        }
    };
}

module.exports = { registerLoaders };