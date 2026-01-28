import koffi from 'koffi';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * Interface para as opções do servidor Proxy HTTP/3.
 */
export interface ProxyOptions {
    /** Porta HTTP para redirecionamento (ex: ":80") */
    httpPort: string;
    /** Porta HTTPS/HTTP3 (ex: ":443") */
    httpsPort: string;
    /** URL do servidor backend (ex: "http://localhost:3000") */
    backendUrl: string;
    /** Caminho para o arquivo de certificado SSL (.pem) */
    certPath: string;
    /** Caminho para o arquivo de chave privada SSL (.pem) */
    keyPath: string;
    /** (Opcional) Sobrescreve o caminho da biblioteca manualmente */
    customLibPath?: string;
}

// Assinatura da função Go
// func StartServer(httpPort, httpsPort, backendUrl, certPath, keyPath) *C.char
type StartServerFunc = (
    httpPort: string,
    httpsPort: string,
    backendUrl: string,
    certPath: string,
    keyPath: string
) => string | null;

export class NativeProxy {
    private static instance: StartServerFunc | null = null;

    /**
     * Detecta a plataforma e arquitetura para montar o nome do arquivo.
     * Padrão esperado: vatts-proxy-{os}-{arch}.node
     * Ex: vatts-proxy-win-x64.node
     */
    public static getLibPath(): string {
        const platform = os.platform();
        const arch = os.arch();

        let osName = '';
        let ext = '.node'; // Mantendo sua convenção de extensão

        // Mapeamento de SO
        switch (platform) {
            case 'win32':
                osName = 'win';
                break;
            case 'linux':
                osName = 'linux';
                break;
            case 'darwin':
                osName = 'darwin';
                break;
            default:
                throw new Error(`Sistema operacional não suportado: ${platform}`);
        }

        // Mapeamento de Arquitetura
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

        // Ajuste o caminho relativo conforme a estrutura do seu projeto
        // Assumindo que estará na pasta '../proxy' relativo a este arquivo
        return path.resolve(__dirname, '..', 'core-go', filename);
    }

    /**
     * Carrega a biblioteca nativa usando Koffi.
     */
    private static loadLibrary(customPath?: string): StartServerFunc {
        if (this.instance) return this.instance;

        const libPath = customPath || this.getLibPath();

        if (!fs.existsSync(libPath)) {
            throw new Error(
                `Biblioteca nativa não encontrada: ${libPath}.\n`
            );
        }

        try {
            const lib = koffi.load(libPath);
            // Mapeia a função Go: StartServer
            // Argumentos: 5 strings
            // Retorno: string (erro) ou null (sucesso)
            this.instance = lib.func('StartServer', 'str', ['str', 'str', 'str', 'str', 'str']);
            return this.instance;
        } catch (error) {
            throw new Error(`Falha ao carregar a biblioteca nativa de proxy em ${libPath}: ${error}`);
        }
    }

    /**
     * Inicia o servidor Proxy.
     * Nota: A execução no Go é assíncrona (non-blocking), então esta função retorna
     * imediatamente após iniciar as threads do servidor, a menos que haja um erro inicial.
     */
    public static start(options: ProxyOptions): void {
        const {
            httpPort,
            httpsPort,
            backendUrl,
            certPath,
            keyPath,
            customLibPath
        } = options;

        const startServer = this.loadLibrary(customLibPath);

        // Resolve caminhos absolutos para evitar erros no Go
        const absCert = path.resolve(certPath);
        const absKey = path.resolve(keyPath);

        // Validação básica de existência dos arquivos de certificado antes de chamar o Go
        if (!fs.existsSync(absCert)) {
            throw new Error(`Arquivo de certificado não encontrado: ${absCert}`);
        }
        if (!fs.existsSync(absKey)) {
            throw new Error(`Arquivo de chave não encontrado: ${absKey}`);
        }

        // Chama a função nativa
        const errorMsg = startServer(httpPort, httpsPort, backendUrl, absCert, absKey);

        if (errorMsg) {
            throw new Error(`[Vatts Proxy Error] ${errorMsg}`);
        }
    }
}

/**
 * API Pública
 */
export const startProxy = (options: ProxyOptions) => {
    return NativeProxy.start(options);
};

// Export padrão
export default startProxy;