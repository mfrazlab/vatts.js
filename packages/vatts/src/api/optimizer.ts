import koffi from 'koffi';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * Interface para as opções do otimizador.
 */
export interface OptimizerOptions {
    /** Diretório onde estão os arquivos a serem otimizados (ex: .vatts/exported) */
    targetDir: string;
    /** (Opcional) Diretório de saída. Padrão: 'optimized' dentro do target */
    outputDir?: string;
    /** (Opcional) Lista de arquivos ou pastas a serem ignorados */
    ignoredPatterns?: string[];
    /** (Opcional) Sobrescreve o caminho da biblioteca manualmemte */
    customLibPath?: string;
}

// Assinatura da função Go
// Alterado: agora retorna string | null. Se string, é o erro. Se null, sucesso.
type OptimizeFunc = (target: string, output: string, ignored: string) => string | null;

export class NativeOptimizer {
    private static instance: OptimizeFunc | null = null;

    /**
     * Detecta a plataforma e arquitetura para montar o nome do arquivo.
     * Padrão esperado: optimizer-{os}-{arch}.{ext}
     * Ex: optimizer-win-64.dll, optimizer-linux-arm64.so
     */
    public static getLibPath(): string {
        const platform = os.platform(); // 'win32', 'linux', 'darwin'
        const arch = os.arch();         // 'x64', 'arm64'

        let osName = '';
        let ext = '.node';

        // Mapeamento de SO
        switch (platform) {
            case 'win32':
                osName = 'win';
                break;
            case 'linux':
                osName = 'linux';
                break;
            case 'darwin':
                osName = 'darwin'; // ou 'darwin', ajuste conforme seu build
                break;
            default:
                throw new Error(`Sistema operacional não suportado: ${platform}`);
        }

        // Mapeamento de Arquitetura (user pediu '64' para x64)
        let archName = '';
        switch (arch) {
            case 'x64':
                archName = 'x64';
                break;
            case 'arm64':
                archName = 'arm64';
                break;
            default:
                throw new Error(`Arquitetura não suportada: ${arch}`);
        }

        const filename = `core-${osName}-${archName}${ext}`;

        // Caminho relativo: sobe um nível (fora do dist/src) e entra em builds
        // Ajuste o '..' conforme a estrutura final da sua pasta de compilação
        return path.resolve(__dirname, '..', 'core-go', filename);
    }

    /**
     * Carrega a biblioteca nativa usando Koffi.
     */
    private static loadLibrary(customPath?: string): OptimizeFunc {
        if (this.instance) return this.instance;

        const libPath = customPath || this.getLibPath();

        if (!fs.existsSync(libPath)) {
            throw new Error(
                `Biblioteca nativa não encontrada: ${libPath}.\n`
            );
        }

        try {
            const lib = koffi.load(libPath);
            // Mapeia a função Go: func Optimize(...) *C.char
            // Em Koffi, 'str' como retorno significa char* (string C)
            // Se o Go retornar nil, o Koffi converte para null no JS
            this.instance = lib.func('Optimize', 'str', ['str', 'str', 'str']);
            return this.instance;
        } catch (error) {
            throw new Error(`Falha ao carregar a biblioteca nativa em ${libPath}: ${error}`);
        }
    }

    /**
     * Executa a otimização.
     */
    public static run(options: OptimizerOptions): void {
        const { targetDir, outputDir = '', ignoredPatterns = [], customLibPath } = options;

        const optimize = this.loadLibrary(customLibPath);

        const absTarget = path.resolve(targetDir);
        const absOutput = outputDir ? path.resolve(outputDir) : '';
        const ignoredStr = ignoredPatterns.join(',');

        // Validação básica
        if (!fs.existsSync(absTarget)) {
            return;
        }

        const errorMsg = optimize(absTarget, absOutput, ignoredStr);
        if (errorMsg) {
            throw new Error(errorMsg);
        }
    }
}

/**
 * API Pública
 */
export const runOptimizer = (options: OptimizerOptions) => {
    return NativeOptimizer.run(options);
};

// Export padrão também para facilitar imports
export default runOptimizer;