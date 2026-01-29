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
    /** Habilita suporte a WebTransport */
    enableWebTransport?: boolean;
    /** (Opcional) Sobrescreve o caminho da biblioteca manualmente */
    customLibPath?: string;
}

/**
 * Interface para os callbacks do WebTransport.
 * Use isso para tipar o handler ao chamar addTransport.
 */
export interface WebTransportCallbacks {
    /** Chamado quando um cliente conecta na rota */
    onConnect?: (client: WebTransportClient) => void;
    /** Chamado quando uma mensagem é recebida do cliente */
    onMessage: (client: WebTransportClient, msg: string) => void;
    /** Chamado quando a conexão é fechada */
    onClose?: (client: WebTransportClient) => void;
}

// Wrapper para interagir com o cliente conectado via Go
export class WebTransportClient {
    constructor(
        public readonly id: string,
        private sendFunc: Function,
        private closeFunc: Function
    ) {}

    // Envia dados para o cliente (Vue)
    public send(data: string) {
        this.sendFunc(this.id, data);
    }

    // Força o fechamento da conexão
    public close() {
        this.closeFunc(this.id);
    }
}

export class NativeProxy {
    private static instanceStart: Function | null = null;
    private static instanceSend: Function | null = null;
    private static instanceClose: Function | null = null;

    // Mapa de rotas -> callbacks
    private static transportRoutes = new Map<string, WebTransportCallbacks>();

    // Cache de clientes ativos para evitar recriar o objeto a cada mensagem
    private static activeClients = new Map<string, WebTransportClient>();

    /**
     * Registra uma rota WebTransport.
     * @param route Caminho da rota (ex: "/chat")
     * @param handler Objeto com callbacks
     */
    public static addTransportRoute(route: string, handler: WebTransportCallbacks) {
        this.transportRoutes.set(route, handler);
    }

    /**
     * Detecta a plataforma e arquitetura para montar o nome do arquivo.
     */
    public static getLibPath(): string {
        const platform = os.platform();
        const arch = os.arch();
        let osName = '';
        let ext = '.node';

        switch (platform) {
            case 'win32': osName = 'win'; break;
            case 'linux': osName = 'linux'; break;
            case 'darwin': osName = 'darwin'; break;
            default: throw new Error(`Sistema operacional não suportado: ${platform}`);
        }

        let archName = '';
        switch (arch) {
            case 'x64': archName = 'x64'; break;
            case 'arm64': archName = 'arm64'; break;
            default: throw new Error(`Arquitetura não suportada: ${arch}`);
        }

        const filename = `core-${osName}-${archName}${ext}`;
        return path.resolve(__dirname, '..', 'core-go', filename);
    }

    private static loadLibrary(customPath?: string) {
        if (this.instanceStart) return;

        const libPath = customPath || this.getLibPath();
        if (!fs.existsSync(libPath)) {
            throw new Error(`Biblioteca nativa não encontrada: ${libPath}.\n`);
        }

        try {
            const lib = koffi.load(libPath);

            // 1. Define o callback do C (Go chama isso)
            const OnWebTransportMessage = koffi.proto('void OnWebTransportMessage(str id, str path, str event, str data)');

            // 2. Mapeia as funções do Go
            this.instanceStart = lib.func('StartServer', 'str', ['str', 'str', 'str', 'str', 'str', 'str']);
            this.instanceSend = lib.func('WebTransportSend', 'void', ['str', 'str']);
            this.instanceClose = lib.func('WebTransportClose', 'void', ['str']);
            const registerCallback = lib.func('RegisterWebTransportCallback', 'void', [koffi.pointer(OnWebTransportMessage)]);

            // 3. Registra a função JS que o Go vai chamar
            const jsCallback = (id: string, path: string, event: string, data: string) => {
                this.handleGoCallback(id, path, event, data);
            };
            registerCallback(jsCallback);

        } catch (error) {
            throw new Error(`Falha ao carregar a biblioteca nativa: ${error}`);
        }
    }

    private static handleGoCallback(id: string, path: string, event: string, data: string) {
        const routeHandler = this.transportRoutes.get(path);

        // Se não tiver rota registrada, o Go vai manter a conexão aberta mas sem lógica,
        // ou podemos fechar. Por enquanto, ignoramos.
        if (!routeHandler) return;

        let client = this.activeClients.get(id);
        if (!client) {
            client = new WebTransportClient(id, this.instanceSend!, this.instanceClose!);
            this.activeClients.set(id, client);
        }

        try {
            if (event === 'CONNECT') {
                if (routeHandler.onConnect) routeHandler.onConnect(client);
            } else if (event === 'MESSAGE') {
                if (routeHandler.onMessage) routeHandler.onMessage(client, data);
            } else if (event === 'CLOSE') {
                if (routeHandler.onClose) routeHandler.onClose(client);
                this.activeClients.delete(id);
            }
        } catch (e) {
            console.error(`[Vatts WebTransport Error] Handler failed for ${path}:`, e);
        }
    }

    public static start(options: ProxyOptions): void {
        const { httpPort, httpsPort, backendUrl, certPath, keyPath, customLibPath, enableWebTransport } = options;

        this.loadLibrary(customLibPath);

        const absCert = path.resolve(certPath);
        const absKey = path.resolve(keyPath);

        if (!fs.existsSync(absCert)) throw new Error(`Certificado não encontrado: ${absCert}`);
        if (!fs.existsSync(absKey)) throw new Error(`Chave não encontrada: ${absKey}`);

        const strWebTransport = enableWebTransport ? "true" : "false";

        // Chama StartServer no Go
        const errorMsg = this.instanceStart!(httpPort, httpsPort, backendUrl, absCert, absKey, strWebTransport);

        if (errorMsg) {
            throw new Error(`[Vatts Proxy Error] ${errorMsg}`);
        }
    }
}

export const startProxy = (options: ProxyOptions) => {
    return NativeProxy.start(options);
};

export const addTransport = (route: string, handler: WebTransportCallbacks) => {
    return NativeProxy.addTransportRoute(route, handler);
}

export default startProxy;