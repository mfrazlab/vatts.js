import koffi from 'koffi';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * Interface para opções do Servidor Nativo (Go HTTP/3)
 */
export interface NativeServerOptions {
    httpPort: string;
    httpsPort: string;
    certPath: string;
    keyPath: string;
    // Callback recebe o ID e o Buffer cru (não string)
    onData: (connId: number, data: Buffer) => void;
    onClose?: (connId: number) => void;
    customLibPath?: string;
}

// Definição dos tipos dos callbacks C para o Koffi
// typedef void (*OnDataCallback)(int connID, void* data, int length);
// Usamos 'void*' para dados genéricos e 'int' para o tamanho
const OnDataCallback = koffi.proto('void OnDataCallback(int connID, void* data, int length)');

// typedef void (*OnCloseCallback)(int connID);
const OnCloseCallback = koffi.proto('void OnCloseCallback(int connID)');

export class NativeServer {
    private static lib: any = null;
    private static startFunc: any = null;
    private static writeFunc: any = null;
    private static closeConnFunc: any = null;

    private static registeredCallbacks: any[] = [];

    public static getLibPath(): string {
        const platform = os.platform();
        const arch = os.arch();

        let osName = '';
        let ext = '.node';

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
        return path.resolve(__dirname, '..', 'core-go', filename);
    }

    private static loadLibrary(customPath?: string) {
        if (this.lib) return;

        const libPath = customPath || this.getLibPath();

        if (!fs.existsSync(libPath)) {
            const altPath = path.resolve(process.cwd(), libPath);
            if (!fs.existsSync(altPath)) {
                console.warn(`Native Server Library not found at: ${libPath}`);
                return;
            }
        }

        try {
            this.lib = koffi.load(libPath);

            // func StartServer(..., onData, onClose)
            this.startFunc = this.lib.func('StartServer', 'str', [
                'str', 'str', 'str', 'str',
                koffi.pointer(OnDataCallback),
                koffi.pointer(OnCloseCallback)
            ]);

            // Mapeando WriteToConn do Go (Atualizado para binário):
            // func WriteToConn(connID int, dataC *void, length int) *char
            this.writeFunc = this.lib.func('WriteToConn', 'str', ['int', 'void*', 'int']);

            this.closeConnFunc = this.lib.func('CloseConn', 'void', ['int']);

        } catch (error) {
            throw new Error(`Failed to load native library: ${error}`);
        }
    }

    public static start(options: NativeServerOptions): void {
        const {
            httpPort,
            httpsPort,
            certPath,
            keyPath,
            onData,
            onClose,
            customLibPath
        } = options;

        this.loadLibrary(customLibPath);

        if (!this.startFunc) return;

        // Callback de DADOS: Agora recebe pointer e length
        const onDataPtr = koffi.register((connId: number, ptr: any, len: number) => {
            try {
                // Decodifica a memória crua do C para um Buffer do Node
                // 'uint8' cria um array de bytes, Buffer.from empacota isso
                const buffer = Buffer.from(koffi.decode(ptr, 'uint8', len));
                onData(connId, buffer);
            } catch (e) {
                console.error("Error inside NativeServer onData callback:", e);
            }
        }, koffi.pointer(OnDataCallback));

        const onClosePtr = koffi.register((connId: number) => {
            try {
                if (onClose) onClose(connId);
            } catch (e) {
                console.error("Error inside NativeServer onClose callback:", e);
            }
        }, koffi.pointer(OnCloseCallback));

        this.registeredCallbacks.push(onDataPtr, onClosePtr);

        const err = this.startFunc(
            httpPort,
            httpsPort,
            certPath,
            keyPath,
            onDataPtr,
            onClosePtr
        );

        if (err) {
            throw new Error(`Native Server Start Error: ${err}`);
        }
    }

    /**
     * Envia dados binários de volta para o Go
     */
    public static write(connId: number, data: Buffer | string): void {
        if (!this.writeFunc) return;

        let buffer: Buffer;
        if (typeof data === 'string') {
            buffer = Buffer.from(data);
        } else {
            buffer = data;
        }

        // Passa o buffer e o tamanho dele explicitamente
        const err = this.writeFunc(connId, buffer, buffer.length);
        if (err) {
            // console.error(`Write error to conn ${connId}: ${err}`);
        }
    }

    public static closeConnection(connId: number): void {
        if (!this.closeConnFunc) return;
        this.closeConnFunc(connId);
    }
}

export const startServer = (options: NativeServerOptions) => {
    return NativeServer.start(options);
};

export const writeToConnection = (id: number, data: Buffer | string) => {
    return NativeServer.write(id, data);
};

export const closeConnection = (id: number) => {
    return NativeServer.closeConnection(id);
};

export default { start: startServer, write: writeToConnection, close: closeConnection };