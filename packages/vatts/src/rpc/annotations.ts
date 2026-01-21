/**
 * Símbolo único para marcar funções expostas.
 * Usamos Symbol para garantir que não possa ser falsificado via JSON no payload.
 */
export const RPC_EXPOSED_KEY = Symbol('__rpc_exposed__');

type AnyFn = (...args: any[]) => any;

/**
 * Marca uma ou mais funções como seguras para RPC.
 */
export default function Expose<T extends AnyFn>(fn: T): T;
export default function Expose<T extends AnyFn[]>(fns: [...T]): T;
export default function Expose<T extends AnyFn[]>(...fns: T): T;
export default function Expose(...input: any[]): any {
    const fns: AnyFn[] =
        Array.isArray(input[0]) ? input[0] : input;

    for (const fn of fns) {
        if (typeof fn !== 'function') {
            throw new TypeError('Expose aceita apenas funções');
        }
        (fn as any)[RPC_EXPOSED_KEY] = true;
    }

    // Retorno:
    // - se veio uma função → retorna ela
    // - se veio lista → retorna a lista
    return input.length === 1 ? input[0] : input;
}
