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
        const allVersions = Object.keys(data.versions);

        // 2. Ordenação SemVer
        // Usamos localeCompare com 'numeric: true' para que 1.10 seja > 1.2
        // E garantimos que 1.0.1-alpha.1 seja detectado corretamente.
        const highestVersion = allVersions.sort((a, b) => {
            return b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' });
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