import path from "path";
import fs from "fs";

// Variável para armazenar o resultado em memória
export let cachedFramework: 'react' | 'vue' | null = null;

export default function detectFramework(projectDir = process.cwd()) {
    // Se já tivermos um resultado, retorna ele direto sem ler o disco
    if (cachedFramework) return cachedFramework;

    try {
        const pkgPath = path.join(projectDir, 'package.json');
        if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };

            if (deps.react || deps['react-dom']) {
                cachedFramework = 'react';
                return cachedFramework;
            }
            if (deps.vue || deps['nuxt']) {
                cachedFramework = 'vue';
                return cachedFramework;
            }
        }
    } catch (e) {
        // Ignora erro de leitura
    }

    // Salva o fallback no cache para evitar re-execução em caso de falha
    cachedFramework = 'react';
    return cachedFramework;
}