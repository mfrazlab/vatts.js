// Cache simples em memória
import Expose from "vatts/rpc";

let versionCache: any = {
    version: null,
    expiresAt: 0
};

export async function PackageVersion(): Promise<string | null> {
    const TTL = 1000 * 60 * 60; // 1 hora de cache
    const now = Date.now();

    // 1. Verifica se o cache ainda é válido
    if (versionCache.version && now < versionCache.expiresAt) {
        return versionCache.version;
    }

    try {
        const response = await fetch('https://registry.npmjs.org/vatts');
        const data = await response.json();

        // Pegamos todas as versões disponíveis no objeto 'versions'
        const allVersions = Object.keys(data.versions).filter(v => !v.includes("2.0.1-canary.1"));

        // 2. Ordenação SemVer
        // Usamos localeCompare com 'numeric: true' para que 1.10 seja > 1.2
        // E garantimos que 1.0.1-alpha.1 seja detectado corretamente.
        const highestVersion = allVersions.sort((a, b) => {
            const parse = (v: string) => {
                const [main, pre] = v.split('-');
                const parts = main.split('.').map(Number);
                return { parts, pre };
            };

            const vA = parse(a);
            const vB = parse(b);

            // 1. Compara os números principais (1.2.0)
            for (let i = 0; i < 3; i++) {
                if (vA.parts[i] !== vB.parts[i]) {
                    return vB.parts[i] - vA.parts[i]; // Ordem decrescente
                }
            }

            // 2. Se os números são iguais, a versão SEM sufixo é a maior
            // Ex: 1.2.0 deve vir antes de 1.2.0-alpha
            if (!vA.pre && vB.pre) return -1; // a é maior
            if (vA.pre && !vB.pre) return 1;  // b é maior

            // 3. Se ambos têm sufixo, usa localeCompare neles
            if (vA.pre && vB.pre) {
                return vB.pre.localeCompare(vA.pre, undefined, { numeric: true });
            }

            return 0;
        })[0];

        // 3. Atualiza o cache
        versionCache = {
            version: highestVersion,
            expiresAt: now + TTL
        };

        return highestVersion;
    } catch (error) {
        console.error("Erro ao buscar versão no npm:", error);
        return null;
    }
}

Expose(PackageVersion)