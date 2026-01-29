import koffi from 'koffi';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * Interface para as opções do servidor Proxy HTTP/3.
 */
export interface ProxyOptions {
    /** Porta HTTP para redirecionamento ou servidor principal (ex: ":80") */
    httpPort: string;
    /** Porta HTTPS/HTTP3 (ex: ":443") - Opcional se não usar SSL */
    httpsPort?: string;
    /** URL do servidor backend (ex: "http://localhost:3000") */
    backendUrl: string;
    /** Caminho para o arquivo de certificado SSL (.pem) - Opcional */
    certPath?: string;
    /** Caminho para o arquivo de chave privada SSL (.pem) - Opcional */
    keyPath?: string;
    /** (Opcional) Sobrescreve o caminho da biblioteca manualmente */
    customLibPath?: string;
    /** Modo de desenvolvimento */
    dev: string;
}

// Assinatura da função Go
// func StartServer(httpPort, httpsPort, backendUrl, certPath, keyPath, dev) *C.char
type StartServerFunc = (
    httpPort: string,
    httpsPort: string,
    backendUrl: string,
    certPath: string,
    keyPath: string,
    dev: string
) => string | null;


export class NativeProxy {
    private static instance: StartServerFunc | null = null;

    /**
     * Detecta a plataforma e arquitetura para montar o nome do arquivo.
     * Padrão esperado: core-{os}-{arch}.node
     * Ex: core-win-x64.node
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
        // Assumindo que estará na pasta '../core-go/binaries' ou similar relativo a este arquivo
        // Ajustei para apontar para core-go/binaries baseando-se na estrutura do package.json
        return path.resolve(__dirname, '..', 'core-go', 'binaries', filename);
    }

    /**
     * Carrega a biblioteca nativa usando Koffi.
     */
    private static loadLibrary(customPath?: string): StartServerFunc {
        if (this.instance) return this.instance;

        const libPath = customPath || this.getLibPath();

        if (!fs.existsSync(libPath)) {
            // Tenta fallback para pasta raiz do core-go se não achar em binaries (para dev local)
            const fallbackPath = path.resolve(__dirname, '..', 'core-go', path.basename(libPath));
            if (!fs.existsSync(fallbackPath) && !customPath) {
                 throw new Error(
                    `Biblioteca nativa não encontrada em: ${libPath}\n`
                );
            }
        }

        try {
            const finalPath = fs.existsSync(libPath) ? libPath : path.resolve(__dirname, '..', 'core-go', path.basename(libPath));
            const lib = koffi.load(finalPath);
            
            // Mapeia a função Go: StartServer
            // Argumentos: 6 strings
            // Retorno: string (erro) ou null (sucesso)
            this.instance = lib.func('StartServer', 'str', ['str', 'str', 'str', 'str', 'str', 'str']);
            return this.instance;
        } catch (error) {
            throw new Error(`Falha ao carregar a biblioteca nativa de proxy: ${error}`);
        }
    }

    /**
     * Inicia o servidor Proxy.
     * Nota: A execução no Go é assíncrona (non-blocking).
     */
    public static start(options: ProxyOptions): void {
        const {
            httpPort,
            httpsPort = "", // Default vazio para Go entender que não tem SSL
            backendUrl,
            certPath = "", // Default vazio
            keyPath = "",  // Default vazio
            customLibPath,
            dev
        } = options;

        const startServer = this.loadLibrary(customLibPath);

        // Resolve caminhos absolutos apenas se foram fornecidos
        let absCert = "";
        let absKey = "";

        if (certPath && keyPath) {
            absCert = path.resolve(certPath);
            absKey = path.resolve(keyPath);

            // Validação de existência apenas se estamos tentando usar SSL
            if (!fs.existsSync(absCert)) {
                throw new Error(`Arquivo de certificado não encontrado: ${absCert}`);
            }
            if (!fs.existsSync(absKey)) {
                throw new Error(`Arquivo de chave não encontrado: ${absKey}`);
            }
        }

        // Chama a função nativa
        // Passamos strings vazias onde não há valor, o Go cuidará da lógica (useSSL check)
        const errorMsg = startServer(httpPort, httpsPort, backendUrl, absCert, absKey, dev);

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