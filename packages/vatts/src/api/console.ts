/*
 * This file is part of the Vatts.js Project.
 * Copyright (c) 2026 mfraz
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
 * Handle para linhas dinâmicas.
 */
export class DynamicLine {
    private readonly _id = Symbol();

    constructor(initialContent: string) {
        Console['registerDynamicLine'](this._id, initialContent);
    }

    update(newContent: string): void {
        Console['updateDynamicLine'](this._id, newContent);
    }

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
    private static activeLines: { id: symbol; content: string }[] = [];
    private static lastRenderedLines = 0;

    // --- RENDERIZAÇÃO ---

    private static redrawDynamicLines(): void {
        const stream = process.stdout;
        if (this.lastRenderedLines > 0) {
            try { readline.moveCursor(stream, 0, -this.lastRenderedLines); } catch {}
        }
        readline.cursorTo(stream, 0);
        readline.clearScreenDown(stream);

        if (this.activeLines.length > 0) {
            stream.write(this.activeLines.map(l => this.formatLog('WAIT', l.content)).join('\n') + '\n');
        }
        this.lastRenderedLines = this.activeLines.length;
    }

    private static writeStatic(content: string): void {
        const stream = process.stdout;
        if (this.lastRenderedLines > 0) {
            try { readline.moveCursor(stream, 0, -this.lastRenderedLines); } catch {}
            readline.cursorTo(stream, 0);
            readline.clearScreenDown(stream);
        }

        console.log(content.replace(/\n$/, ''));

        if (this.activeLines.length > 0) {
            stream.write(this.activeLines.map(l => this.formatLog('WAIT', l.content)).join('\n') + '\n');
            this.lastRenderedLines = this.activeLines.length;
        } else {
            this.lastRenderedLines = 0;
        }
    }

    private static formatLog(level: Levels | string, message: string, color?: Colors | null): string {
        let icon = '•';
        let baseColor = Colors.FgWhite;

        switch (level) {
            case Levels.ERROR:
                icon = '✕';
                baseColor = Colors.FgRed;
                break;
            case Levels.WARN:
                icon = '▲';
                baseColor = Colors.FgYellow;
                break;
            case Levels.INFO:
                icon = 'ℹ';
                baseColor = Colors.FgCyan;
                break;
            case Levels.SUCCESS:
                icon = '✓';
                baseColor = Colors.FgGreen;
                break;
            case Levels.DEBUG:
                icon = '›';
                baseColor = Colors.FgGray;
                break;
            case 'WAIT':
                icon = '○';
                baseColor = Colors.FgCyan;
                break;
            default:
                icon = '•';
                baseColor = color || Colors.FgWhite;
                break;
        }

        const gray = Colors.FgGray;
        const bold = Colors.Bright;
        const reset = Colors.Reset;

        const time = new Date().toLocaleTimeString('pt-BR', { hour12: false });
        const levelStr = level === 'WAIT' ? '' : ` ${bold}${level}${reset}`;

        return ` ${gray}${time}${reset}  ${baseColor}${icon}${levelStr}${reset}  ${message}`;
    }

    // --- INTERATIVIDADE (SELECTION) ---

    /**
     * Menu de seleção interativo usando setas do teclado.
     * @param options Objeto no formato { "valor_retornado": "Label Exibida" }
     */
    static async selection<T = string>(question: string, options: Record<string, T>): Promise<string> {
        const entries = Object.entries(options);
        let currentIndex = 0;
        const stream = process.stdout;
        let firstRender = true;

        if (this.lastRenderedLines > 0) {
            readline.moveCursor(stream, 0, -this.lastRenderedLines);
            readline.cursorTo(stream, 0);
            readline.clearScreenDown(stream);
        }

        stream.write('\x1b[?25l'); // Hide cursor

        const render = () => {
            // Se não for a primeira vez, sobe as linhas do menu anterior para sobrescrever
            if (!firstRender) {
                readline.moveCursor(stream, 0, -(entries.length + 1));
            }

            readline.cursorTo(stream, 0);
            readline.clearScreenDown(stream);

            stream.write(` ${Colors.FgCyan}?${Colors.Reset} ${Colors.Bright}${question}${Colors.Reset}\n`);
            entries.forEach(([key, label], i) => {
                const isSelected = i === currentIndex;
                const prefix = isSelected ? `${Colors.FgCyan}❯${Colors.Reset}` : ' ';
                const text = isSelected ? `${Colors.FgCyan}${Colors.Bright}${label}${Colors.Reset}` : `${Colors.FgGray}${label}${Colors.Reset}`;
                stream.write(`  ${prefix} ${text}\n`);
            });

            firstRender = false;
        };

        render();

        return new Promise((resolve) => {
            const handleKey = (_chunk: any, key: any) => {
                if (!key) return;

                if (key.name === 'up') {
                    currentIndex = (currentIndex - 1 + entries.length) % entries.length;
                    render();
                } else if (key.name === 'down') {
                    currentIndex = (currentIndex + 1) % entries.length;
                    render();
                } else if (key.name === 'return') {
                    process.stdin.removeListener('keypress', handleKey);
                    if (process.stdin.isTTY) process.stdin.setRawMode(false);
                    process.stdin.pause();
                    stream.write('\x1b[?25h'); // Show cursor

                    // Limpa o menu final antes de escrever o log estático
                    readline.moveCursor(stream, 0, -(entries.length + 1));
                    readline.cursorTo(stream, 0);
                    readline.clearScreenDown(stream);

                    const [selectedKey, selectedLabel] = entries[currentIndex];
                    this.writeStatic(` ${Colors.FgCyan}✓${Colors.Reset} ${Colors.Bright}${question}${Colors.Reset} ${Colors.FgGray}›${Colors.Reset} ${selectedLabel}`);

                    resolve(selectedKey);
                } else if (key.ctrl && key.name === 'c') {
                    stream.write('\x1b[?25h');
                    process.exit();
                }
            };

            readline.emitKeypressEvents(process.stdin);
            if (process.stdin.isTTY) process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.on('keypress', handleKey);
        });
    }

    // --- MÉTODOS PÚBLICOS ---

    static error(...args: any[]): void { this.log(Levels.ERROR, null, ...args); }
    static warn(...args: any[]): void { this.log(Levels.WARN, null, ...args); }
    static info(...args: any[]): void { this.log(Levels.INFO, null, ...args); }
    static success(...args: any[]): void { this.log(Levels.SUCCESS, null, ...args); }
    static default_log(...args: any[]): void { this.log(Levels.INFO, null, ...args); }
    static debug(...args: any[]): void { this.log(Levels.DEBUG, null, ...args); }

    static logCustomLevel(levelName: string, without: boolean = true, color?: Colors, ...args: any[]): void {
        if (without) { this.logWithout(levelName as Levels, color, ...args); }
        else { this.log(levelName as Levels, color, ...args); }
    }

    static logWithout(level: Levels, colors?: Colors, ...args: any[]): void {
        this.log(level, colors, ...args);
    }

    static log(level: Levels, colors?: Colors | null, ...args: any[]): void {
        let output = "";
        for (const arg of args) {
            let msg = (arg instanceof Error) ? arg.stack : (typeof arg === 'string') ? arg : JSON.stringify(arg, null, 2);
            if (msg) output += this.formatLog(level, msg, colors) + '\n';
        }
        this.writeStatic(output.replace(/\n$/, ''));
    }

    static async ask(question: string, defaultValue?: string): Promise<string> {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const defaultPart = defaultValue ? ` ${Colors.FgGray}(${defaultValue})${Colors.Reset}` : '';
        const prompt = ` ${Colors.FgCyan}?${Colors.Reset} ${Colors.Bright}${question}${Colors.Reset}${defaultPart}\n ${Colors.FgCyan}❯${Colors.Reset} `;

        return new Promise(resolve => {
            rl.question(prompt, ans => {
                rl.close();
                const value = ans.trim();
                resolve(value === '' && defaultValue !== undefined ? defaultValue : value);
            });
        });
    }

    static async confirm(message: string, defaultYes = false): Promise<boolean> {
        const suffix = defaultYes ? 'Y/n' : 'y/N';
        const ans = (await this.ask(`${message} ${Colors.FgGray}[${suffix}]${Colors.Reset}`)).toLowerCase();
        if (ans === '') return defaultYes;
        return ['y', 'yes', 's', 'sim'].includes(ans);
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
        output += `│ ${Colors.Bright}${Colors.FgCyan}${'Field'.padEnd(fieldLen)}${Colors.Reset} │ ${Colors.Bright}${Colors.FgCyan}${'Value'.padEnd(valueLen)}${Colors.Reset} │\n`;
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
        const index = this.activeLines.findIndex(l => l.id === id);
        if (index > -1) {
            this.activeLines.splice(index, 1);
            this.writeStatic(this.formatLog(Levels.SUCCESS, finalContent));
        }
    }
}