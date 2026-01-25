/*
 * This file is part of the Vatts.js Project.
 * Copyright (c) 2026 itsmuzin
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import readline from 'node:readline';

/**
 * Um "handle" para uma linha dinâmica. As instâncias desta classe
 * são retornadas por `Console.dynamicLine()` e usadas para controlar
 * o conteúdo da linha.
 */
export class DynamicLine {
    // A ID é usada internamente pela classe Console para rastrear esta linha.
    private readonly _id = Symbol();

    constructor(initialContent: string) {
        // Registra esta nova linha na classe Console para que ela seja renderizada.
        Console['registerDynamicLine'](this._id, initialContent);
    }

    /**
     * Atualiza o conteúdo da linha no console.
     * @param newContent O novo texto a ser exibido.
     */
    update(newContent: string): void {
        Console['updateDynamicLine'](this._id, newContent);
    }

    /**
     * Finaliza a linha, opcionalmente com um texto final, e a torna estática.
     * @param finalContent O texto final a ser exibido.
     */
    end(finalContent: string): void {
        Console['endDynamicLine'](this._id, finalContent);
    }
}

export enum Colors {
    Reset = "\x1b[0m",
    Bright = "\x1b[1m",
    Dim = "\x1b[2m",
    Underscore = "\x1b[4m",
    Blink = "\x1b[5m",
    Reverse = "\x1b[7m",
    Hidden = "\x1b[8m",

    FgBlack = "\x1b[30m",
    FgRed = "\x1b[31m",
    FgGreen = "\x1b[32m",
    FgYellow = "\x1b[33m",
    FgBlue = "\x1b[34m",
    FgMagenta = "\x1b[35m",
    FgCyan = "\x1b[36m",
    FgWhite = "\x1b[37m",
    FgGray = "\x1b[90m",
    FgAlmostWhite = "\x1b[38;2;220;220;220m",
    BgBlack = "\x1b[40m",
    BgRed = "\x1b[41m",
    BgGreen = "\x1b[42m",
    BgYellow = "\x1b[43m",
    BgBlue = "\x1b[44m",
    BgMagenta = "\x1b[45m",
    BgCyan = "\x1b[46m",
    BgWhite = "\x1b[47m",
    BgGray = "\x1b[100m",
}


export enum Levels {
    ERROR = "ERROR",
    WARN = "WARN",
    INFO = "INFO",
    DEBUG = "DEBUG",
    SUCCESS = "SUCCESS"
}

export default class Console {
    // Armazena o estado de todas as linhas dinâmicas ativas
    private static activeLines: { id: symbol; content: string }[] = [];

    // Quantas linhas foram efetivamente renderizadas na última operação.
    private static lastRenderedLines = 0;

    // --- MÉTODOS PRIVADOS PARA GERENCIAR A RENDERIZAÇÃO ---

    private static redrawDynamicLines(): void {
        const stream = process.stdout;

        if (this.lastRenderedLines > 0) {
            try {
                readline.moveCursor(stream, 0, -this.lastRenderedLines);
            } catch (_e) {
                // Em terminais estranhos a movimentação pode falhar — ignoramos.
            }
        }

        readline.cursorTo(stream, 0);
        readline.clearScreenDown(stream);

        if (this.activeLines.length > 0) {
            // ATUALIZADO: Aplica o formato de log (Timestamp + Style) nas linhas dinâmicas
            // Usamos um nível pseudo 'WAIT' para indicar processo em andamento
            stream.write(this.activeLines.map(l => this.formatLog('WAIT', l.content, Colors.FgRed)).join('\n') + '\n');
        }

        this.lastRenderedLines = this.activeLines.length;
    }

    private static writeStatic(content: string): void {
        const stream = process.stdout;

        if (this.lastRenderedLines > 0) {
            try {
                readline.moveCursor(stream, 0, -this.lastRenderedLines);
            } catch (_e) {}
            readline.cursorTo(stream, 0);
            readline.clearScreenDown(stream);
        }

        // MODIFICAÇÃO PRINCIPAL:
        // Substituímos stream.write por console.log aqui.
        // O console.log é interceptado pelos debuggers (VSCode, etc), o stream.write não.
        // Removemos a quebra de linha final (\n$) pois o console.log já adiciona uma automaticamente.
        console.log(content.replace(/\n$/, ''));

        if (this.activeLines.length > 0) {
            // ATUALIZADO: Garante que ao redesenhar após um log estático, o formato se mantém
            stream.write(this.activeLines.map(l => this.formatLog('WAIT', l.content, Colors.FgRed)).join('\n') + '\n');
            this.lastRenderedLines = this.activeLines.length;
        } else {
            this.lastRenderedLines = 0;
        }
    }

    // --- HELPER DE FORMATAÇÃO CENTRALIZADO ---
    private static formatLog(level: Levels | string, message: string, color?: Colors | null): string {
        let icon = '•';
        let baseColor = Colors.FgWhite;

        switch (level) {
            // ✕ : Multiplication X (Matemático, sempre texto)
            case Levels.ERROR:
                icon = '✕';
                baseColor = Colors.FgRed;
                break;

            // ⚠ : Muitas vezes vira emoji. O triângulo ▲ é mais seguro e fica bonito colorido
            // Alternativa: '‼'
            case Levels.WARN:
                icon = '▲';
                baseColor = Colors.FgYellow;
                break;

            // ℹ : Vira emoji. O '𝐢' é um "i" matemático em negrito (Math Bold Small I)
            // Ele mantém a cor que você definir e parece muito um ícone.
            case Levels.INFO:
                icon = '𝐢';
                baseColor = Colors.FgRed; // ALTERADO: Agora é vermelho (o Bright é aplicado abaixo)
                break;

            // ✔ : Às vezes vira emoji verde. O '✓' simples costuma obedecer a cor.
            // Se der erro, use '√' (raiz quadrada)
            case Levels.SUCCESS:
                icon = '✓';
                baseColor = Colors.FgGreen;
                break;

            // ⚙ : Vira emoji cinza. Use '›' ou '»' ou '⌗' para debug
            case Levels.DEBUG:
                icon = '›';
                baseColor = Colors.FgMagenta;
                break;

            // ⟳ : Esse costuma funcionar, mas se virar emoji, use '∞' ou '…'
            case 'WAIT':
                icon = '∞';
                baseColor = Colors.FgRed;
                break;

            default:
                icon = '•';
                baseColor = color || Colors.FgWhite;
                break;
        }

        if (color) {
            baseColor = color;
        }

        const gray = Colors.FgGray;
        const bold = Colors.Bright;
        const reset = Colors.Reset;

        const now = new Date();
        const time = now.toLocaleTimeString('pt-BR', { hour12: false });

        // Retorna a string formatada SEM quebra de linha (quem chama decide onde por)
        // O Colors.Bright + baseColor garante que será Bright Red
        return ` ${gray}${time}${reset}  ${Colors.Bright + baseColor}${icon} ${bold}${level}${reset}  ${message}`;
    }

    // --- MÉTODOS CHAMADOS PELA CLASSE DynamicLine ---
    private static registerDynamicLine(id: symbol, content: string): void {
        this.activeLines.push({ id, content });
        this.redrawDynamicLines();
    }

    private static updateDynamicLine(id: symbol, newContent: string): void {
        const line = this.activeLines.find(l => l.id === id);
        if (line) {
            line.content = newContent;
            this.redrawDynamicLines();
        }
    }

    private static endDynamicLine(id: symbol, finalContent: string): void {
        const lineIndex = this.activeLines.findIndex(l => l.id === id);
        if (lineIndex > -1) {
            this.activeLines.splice(lineIndex, 1);
            // ATUALIZADO: Formata a mensagem final como INFO (ou SUCCESS implícito)
            // para manter consistência visual com o resto dos logs.
            this.writeStatic(this.formatLog(Levels.INFO, finalContent) + '\n');
        }
    }

    // --- MÉTODOS DE LOG PÚBLICOS ---
    static error(...args: any[]): void { this.log(Levels.ERROR, null, ...args); }
    static warn(...args: any[]): void { this.log(Levels.WARN, null, ...args);}
    static info(...args: any[]): void { this.log(Levels.INFO, null, ...args); }
    static success(...args: any[]): void { this.log(Levels.SUCCESS, null, ...args); }
    static debug(...args: any[]): void { this.log(Levels.DEBUG, null, ...args); }

    static logCustomLevel(levelName: string, without: boolean = true, color?: Colors, ...args: any[]): void {
        if (without) { this.logWithout(levelName as Levels, color, ...args); }
        else { this.log(levelName as Levels, color, ...args); }
    }

    static logWithout(level: Levels, colors?:Colors, ...args: any[]): void {
        this.log(level, colors, ...args);
    }

    static log(level: Levels, colors?: Colors | null, ...args: any[]): void {
        let output = "";

        for (const arg of args) {
            let msg = (arg instanceof Error) ? arg.stack : (typeof arg === 'string') ? arg : JSON.stringify(arg, null, 2);
            if (msg) {
                // ATUALIZADO: Usa o helper formatLog
                output += this.formatLog(level, msg, colors) + '\n';
            }
        }

        // Remove a última quebra de linha porque writeStatic já garante uma
        this.writeStatic(output.replace(/\n$/, ''));
    }

    // --- OUTROS MÉTODOS ---
    static async ask(question: string, defaultValue?: string): Promise<string> {
        const stream = process.stdout;
        if (this.lastRenderedLines > 0) {
            try { readline.moveCursor(stream, 0, -this.lastRenderedLines); } catch (_e) {}
            readline.cursorTo(stream, 0);
            readline.clearScreenDown(stream);
        }

        const readlineInterface = readline.createInterface({ input: process.stdin, output: process.stdout });

        const defaultPart = defaultValue ? ` (${defaultValue})` : '';
        const prompt = ` ${Colors.FgRed}?${Colors.Reset} ${question}${Colors.FgGray}${defaultPart}${Colors.Reset} \n ${Colors.FgRed}➜${Colors.Reset} `;

        return new Promise(resolve => {
            readlineInterface.question(prompt, ans => {
                readlineInterface.close();
                const value = ans.trim();
                this.redrawDynamicLines();
                resolve(value === '' && defaultValue !== undefined ? defaultValue : value);
            });
        });
    }

    static async confirm(message: string, defaultYes = false): Promise<boolean> {
        const suffix = defaultYes ? 'Y/n' : 'y/N';
        while (true) {
            const ans = (await this.ask(`${message} ${Colors.FgGray}[${suffix}]${Colors.Reset}`)).toLowerCase();

            if (ans === '') return defaultYes;
            if (['y','yes','s','sim'].includes(ans)) return true;
            if (['n','no','nao','não'].includes(ans)) return false;

            // ATUALIZADO: Formato consistente
            this.writeStatic(`  ${Colors.FgRed}✖ Opção inválida.${Colors.Reset}`);
        }
    }

    static table(data: Record<string, any> | Array<{ Field: string, Value: any }>): void {
        let rows: Array<{ Field: string, Value: any }>;
        if (Array.isArray(data)) {
            rows = data.map(row => ({ Field: String(row.Field), Value: String(row.Value) }));
        } else {
            rows = Object.entries(data).map(([Field, Value]) => ({ Field, Value: String(Value) }));
        }
        const fieldLen = Math.max(...rows.map(r => r.Field.length), 'Field'.length);
        const valueLen = Math.max(...rows.map(r => r.Value.length), 'Value'.length);

        const h_line = '─'.repeat(fieldLen + 2);
        const v_line = '─'.repeat(valueLen + 2);

        const top    = `┌${h_line}┬${v_line}┐`;
        const mid    = `├${h_line}┼${v_line}┤`;
        const bottom = `└${h_line}┴${v_line}┘`;

        let output = top + '\n';
        output += `│ ${Colors.Bright}${Colors.FgGreen}${'Field'.padEnd(fieldLen)}${Colors.Reset} │ ${Colors.Bright}${Colors.FgGreen}${'Value'.padEnd(valueLen)}${Colors.Reset} │\n`;
        output += mid + '\n';

        for (const row of rows) {
            output += `│ ${row.Field.padEnd(fieldLen)} │ ${row.Value.padEnd(valueLen)} │\n`;
        }
        output += bottom + '\n';
        this.writeStatic(output);
    }


    static dynamicLine(initialContent: string): DynamicLine {
        return new DynamicLine(initialContent);
    }
}