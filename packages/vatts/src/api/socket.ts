import koffi from 'koffi';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * Interface para opções do servidor de Socket
 */
export interface SocketServerOptions {
    path: string;
    onMessage: (data: string) => void;
    customLibPath?: string;
}

// Definição do tipo do callback C para o Koffi
const OnMessageCallback = koffi.proto('void OnMessageCallback(const char* data)');

export class NativeSocketServer {
    private static lib: any = null;
    private static startFunc: any = null;
    private static stopFunc: any = null;
    
    // Guardamos referências dos callbacks registrados para o GC não coletá-los
    private static registeredCallbacks: any[] = [];

    /**
     * Resolve o caminho da lib compilada (DLL/SO/DYLIB)
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

    private static loadLibrary(customPath?: string) {
        if (this.lib) return;

        const libPath = customPath || this.getLibPath();
        
        if (!fs.existsSync(libPath)) {
            // Fallback para tentar achar na raiz se não estiver na pasta aninhada
            const altPath = path.resolve(process.cwd(), libPath);
            if (!fs.existsSync(altPath)) {
                throw new Error(`Library not found at: ${libPath}`);
            }
        }

        try {
            this.lib = koffi.load(libPath);

            // Mapeia funções
            // StartSocketServer(path *char, callback func) *char
            this.startFunc = this.lib.func('StartSocketServer', 'str', ['str', koffi.pointer(OnMessageCallback)]);
            
            // StopSocketServer(path *char) *char
            this.stopFunc = this.lib.func('StopSocketServer', 'str', ['str']);

        } catch (error) {
            throw new Error(`Failed to load socket library: ${error}`);
        }
    }

    public static start(options: SocketServerOptions): void {
        const { path: sockPath, onMessage, customLibPath } = options;

        this.loadLibrary(customLibPath);

        // Wrapper do JS para o C. O Koffi cria um ponteiro de função nativa.
        const callbackPtr = koffi.register((data: string) => {
            try {
                // Executa na thread do JS
                onMessage(data);
            } catch (e) {
                console.error("Error inside socket callback:", e);
            }
        }, koffi.pointer(OnMessageCallback));

        // Mantém referência para evitar Garbage Collection
        this.registeredCallbacks.push(callbackPtr);

        // Normaliza path no Windows para garantir que o Go entenda
        // Go no Windows aceita caminhos absolutos normais para unix sockets (C:\path\to.sock)
        const absPath = path.resolve(sockPath);

        const err = this.startFunc(absPath, callbackPtr);
        if (err) {
            throw new Error(`Go Socket Error: ${err}`);
        }
        
        // Setup de limpeza automática ao fechar o processo Node
        const cleanup = () => {
            this.stop(absPath);
        };
        
        process.on('exit', cleanup);
        process.on('SIGINT', () => { cleanup(); process.exit(); });
    }

    public static stop(sockPath: string): void {
        if (!this.stopFunc) return;
        const absPath = path.resolve(sockPath);
        this.stopFunc(absPath);
    }
}

export const startSocket = (path: string, onMessage: (data: string) => void) => {
    return NativeSocketServer.start({ path, onMessage });
};

export default startSocket;