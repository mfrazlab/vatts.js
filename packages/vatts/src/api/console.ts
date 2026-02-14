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

import readline from "node:readline";

/**
 * Handle para linhas dinâmicas.
 */
export class DynamicLine {
    private readonly _id = Symbol();

    constructor(initialContent: string) {
        Console["registerDynamicLine"](this._id, initialContent);
    }

    update(newContent: string): void {
        Console["updateDynamicLine"](this._id, newContent);
    }

    end(finalContent: string): void {
        Console["endDynamicLine"](this._id, finalContent);
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
    SUCCESS = "SUCCESS",
}

export default class Console {
    // Map storing active lines and their offset from the current cursor position (rows up)
    private static activeLines: Map<symbol, { offset: number }> = new Map();

    // Hook para interceptar stdout
    private static originalStdoutWrite = process.stdout.write.bind(process.stdout);
    private static isHooked = false;
    private static isWriting = false;

    // --- THEME / HELPERS VISUAIS ---

    private static ANSI_REGEX =
        /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

    private static stripAnsi(text: string): string {
        return text.replace(this.ANSI_REGEX, "");
    }

    private static fg(r: number, g: number, b: number): string {
        return `\x1b[38;2;${r};${g};${b}m`;
    }

    private static bg(r: number, g: number, b: number): string {
        return `\x1b[48;2;${r};${g};${b}m`;
    }

    private static padCenter(text: string, width: number): string {
        const cleanLen = this.stripAnsi(text).length;
        if (cleanLen >= width) return text;

        const total = width - cleanLen;
        const left = Math.floor(total / 2);
        const right = total - left;

        return " ".repeat(left) + text + " ".repeat(right);
    }

    private static padRight(text: string, width: number): string {
        const cleanLen = this.stripAnsi(text).length;
        if (cleanLen >= width) return text;
        return text + " ".repeat(width - cleanLen);
    }

    private static getTime(): string {
        return new Date().toLocaleTimeString("pt-BR", { hour12: false });
    }

    private static normalizeLevelName(level: any): string {
        if (level === null || level === undefined) return "";
        return String(level).trim();
    }

    private static isKnownLevel(level: any): boolean {
        const normalized = this.normalizeLevelName(level);
        if (!normalized) return false;

        const upper = normalized.toUpperCase();
        return (
            upper === Levels.ERROR ||
            upper === Levels.WARN ||
            upper === Levels.INFO ||
            upper === Levels.DEBUG ||
            upper === Levels.SUCCESS ||
            upper === "WAIT"
        );
    }

    /**
     * Converte uma cor ANSI (Colors.FgX) em um background 24-bit escuro combinando.
     * Isso faz teu methodColor virar um badge bonitinho (fg + bg).
     */
    private static bgForFgColor(fgColor?: Colors | null): string {
        switch (fgColor) {
            case Colors.FgRed:
                return this.bg(86, 24, 24);
            case Colors.FgGreen:
                return this.bg(18, 64, 34);
            case Colors.FgYellow:
                return this.bg(72, 58, 20);
            case Colors.FgBlue:
                return this.bg(18, 38, 70);
            case Colors.FgMagenta:
                return this.bg(46, 28, 66);
            case Colors.FgCyan:
                return this.bg(18, 56, 64);
            case Colors.FgGray:
                return this.bg(48, 48, 48);
            case Colors.FgWhite:
            case Colors.FgAlmostWhite:
                return this.bg(64, 64, 64);
            case Colors.FgBlack:
                return this.bg(20, 20, 20);
            default:
                return this.bg(64, 64, 64);
        }
    }

    private static levelStyle(level: Levels | string): { icon: string; badgeFg: string; badgeBg: string; msgFg: string } {
        const C = {
            red: { fg: this.fg(255, 95, 95), bg: this.bg(86, 24, 24) },
            yellow: { fg: this.fg(255, 210, 90), bg: this.bg(72, 58, 20) },
            cyan: { fg: this.fg(120, 230, 255), bg: this.bg(18, 56, 64) },
            green: { fg: this.fg(120, 255, 165), bg: this.bg(18, 64, 34) },
            gray: { fg: this.fg(170, 170, 170), bg: this.bg(48, 48, 48) },
            white: { fg: this.fg(230, 230, 230), bg: this.bg(64, 64, 64) },
            purple: { fg: this.fg(200, 160, 255), bg: this.bg(46, 28, 66) },
        };

        switch (level) {
            case Levels.ERROR:
                return { icon: "✖", badgeFg: C.red.fg, badgeBg: C.red.bg, msgFg: Colors.FgAlmostWhite };
            case Levels.WARN:
                return { icon: "▲", badgeFg: C.yellow.fg, badgeBg: C.yellow.bg, msgFg: Colors.FgAlmostWhite };
            case Levels.INFO:
                return { icon: "ℹ", badgeFg: C.cyan.fg, badgeBg: C.cyan.bg, msgFg: Colors.FgAlmostWhite };
            case Levels.SUCCESS:
                return { icon: "✓", badgeFg: C.green.fg, badgeBg: C.green.bg, msgFg: Colors.FgAlmostWhite };
            case Levels.DEBUG:
                return { icon: "›", badgeFg: C.gray.fg, badgeBg: C.gray.bg, msgFg: Colors.FgGray };
            case "WAIT":
                return { icon: "", badgeFg: C.purple.fg, badgeBg: C.purple.bg, msgFg: Colors.FgAlmostWhite };
            default:
                return { icon: "", badgeFg: C.white.fg, badgeBg: C.white.bg, msgFg: Colors.FgAlmostWhite };
        }
    }

    /**
     * Agora aceita override de cor pro badge (pra custom levels tipo GET/POST).
     */
    private static renderBadge(level: Levels | string, badgeFgOverride?: Colors | null): string {
        const reset = Colors.Reset;
        const bold = Colors.Bright;

        const normalized = this.normalizeLevelName(level);
        if (normalized === "") return "";

        const name = normalized.toUpperCase();
        const trimmed = name.length > 7 ? name.slice(0, 7) : name;

        // centraliza dentro do badge
        const padded = this.padCenter(trimmed, 7);

        const base = this.levelStyle(level);

        const fg = badgeFgOverride ?? (base.badgeFg as any);
        const bg = badgeFgOverride ? this.bgForFgColor(badgeFgOverride) : base.badgeBg;

        return `${bg}${fg}${bold} ${padded} ${reset}`;
    }

    private static indentMultiline(msg: string, indent: string): string {
        return msg
            .split("\n")
            .map((line, i) => (i === 0 ? line : indent + line))
            .join("\n");
    }

    // --- HELPER PARA CALCULAR ALTURA ADICIONADA ---

    private static countRowsAdded(text: string): number {
        const columns = process.stdout.columns || 80;
        const clean = text.replace(this.ANSI_REGEX, "");

        let rowsAdded = 0;
        const lines = clean.split("\n");

        for (let i = 0; i < lines.length; i++) {
            const width = lines[i].length;
            if (width > 0) {
                rowsAdded += Math.floor((width - 1) / columns);
            }
            if (i < lines.length - 1) {
                rowsAdded++;
            }
        }
        return rowsAdded;
    }

    // --- HOOK SYSTEM ---

    private static hook(): void {
        if (this.isHooked) return;
        this.isHooked = true;

        process.stdout.write = (chunk: any, encoding?: any, callback?: any) => {
            if (this.isWriting) {
                return this.originalStdoutWrite(chunk, encoding, callback);
            }

            const text = chunk.toString();
            const rowsAdded = this.countRowsAdded(text);

            if (rowsAdded > 0) {
                for (const line of this.activeLines.values()) {
                    line.offset += rowsAdded;
                }
            }

            return this.originalStdoutWrite(chunk, encoding, callback);
        };
    }

    // --- HELPER WRITER ---

    private static writeStatic(content: string): void {
        console.log(content.replace(/\n$/, ""));
    }

    /**
     * IMPORTANT: o `color` aqui (quando custom level) agora pinta o BADGE também.
     */
    private static formatLog(level: Levels | string, message: string, color?: Colors | null): string {
        if (message === "end_clear") return "";

        const reset = Colors.Reset;
        const dim = Colors.Dim;

        const time = this.getTime();
        const timePart = `${dim}${Colors.FgGray}${time}${reset}`;

        const normalizedLevel = this.normalizeLevelName(level);
        const isEmptyLevel = normalizedLevel === "";

        const known = this.isKnownLevel(level);
        const st = this.levelStyle(level);

        // Se for custom (não-known) e tiver color, usa ele no badge
        const shouldOverrideBadge = !known && !!color && !isEmptyLevel;

        const badge = isEmptyLevel ? "" : this.renderBadge(level, shouldOverrideBadge ? color : null);

        const gapAfterTime = "  ";
        const gapAfterBadge = badge ? "  " : " ";

        // Icon também acompanha cor do custom
        const iconFg = shouldOverrideBadge ? (color as any) : st.badgeFg;
        const iconSymbol = isEmptyLevel ? "" : st.icon || "";
        const iconPart = `${iconFg}${iconSymbol}${reset}`;

        const prefix = badge
            ? ` ${timePart}${gapAfterTime}${badge}${gapAfterBadge}${iconPart} `
            : ` ${timePart}${gapAfterTime}${iconPart} `;

        // Mensagem: mantém msgFg padrão, mas tu pode também colorir o texto todo se quiser.
        const msgColor = st.msgFg as any;

        const indent = " ".repeat(this.stripAnsi(prefix).length);
        const prettyMsg = this.indentMultiline(message, indent);

        return `${prefix}${msgColor}${prettyMsg}${reset}`;
    }

    // --- INTERATIVIDADE (SELECTION) ---

    static async selection<T = string>(question: string, options: Record<string, T>): Promise<string> {
        const entries = Object.entries(options);
        let currentIndex = 0;
        const stream = process.stdout;
        let firstRender = true;

        stream.write("\x1b[?25l");

        const render = () => {
            if (!firstRender) {
                // FIXED: Changed from +3 to +2 so it doesn't eat the previous logs
                readline.moveCursor(stream, 0, -(entries.length + 2));
            }

            readline.cursorTo(stream, 0);
            readline.clearScreenDown(stream);

            const title = ` ${Colors.FgCyan}${Colors.Bright}◆${Colors.Reset} ${Colors.Bright}${question}${Colors.Reset}`;
            let output = `${title}\n ${Colors.Dim}${Colors.FgGray}Use ↑/↓ e Enter${Colors.Reset}\n`;

            entries.forEach(([_key, label], i) => {
                const isSelected = i === currentIndex;

                const bullet = isSelected
                    ? `${this.bg(18, 56, 64)}${this.fg(120, 230, 255)} ${Colors.Bright}❯${Colors.Reset}${this.bg(18, 56, 64)}${this.fg(120, 230, 255)} `
                    : `   `;

                const text = isSelected
                    ? `${this.bg(18, 56, 64)}${this.fg(220, 245, 255)}${Colors.Bright}${String(label)}${Colors.Reset}`
                    : `${Colors.FgGray}${String(label)}${Colors.Reset}`;

                const suffix = isSelected ? `${this.bg(18, 56, 64)}${Colors.Reset}` : "";
                output += ` ${bullet}${text}${suffix}\n`;
            });

            this.isWriting = true;
            this.originalStdoutWrite(output);
            this.isWriting = false;

            firstRender = false;
        };

        render();

        return new Promise((resolve) => {
            const handleKey = (_chunk: any, key: any) => {
                if (!key) return;

                if (key.name === "up") {
                    currentIndex = (currentIndex - 1 + entries.length) % entries.length;
                    render();
                } else if (key.name === "down") {
                    currentIndex = (currentIndex + 1) % entries.length;
                    render();
                } else if (key.name === "return") {
                    process.stdin.removeListener("keypress", handleKey);
                    if (process.stdin.isTTY) process.stdin.setRawMode(false);
                    process.stdin.pause();
                    stream.write("\x1b[?25h");

                    // FIXED: Changed from +3 to +2 here as well for proper cleanup
                    readline.moveCursor(stream, 0, -(entries.length + 2));
                    readline.cursorTo(stream, 0);
                    readline.clearScreenDown(stream);

                    const [_selectedKey, selectedLabel] = entries[currentIndex];
                    this.writeStatic(this.formatLog(Levels.SUCCESS, `${question} ${Colors.FgGray}›${Colors.Reset} ${String(selectedLabel)}`));

                    resolve(_selectedKey);
                } else if (key.ctrl && key.name === "c") {
                    stream.write("\x1b[?25h");
                    process.exit();
                }
            };

            readline.emitKeypressEvents(process.stdin);
            if (process.stdin.isTTY) process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.on("keypress", handleKey);
        });
    }

    // --- MÉTODOS PÚBLICOS ---

    static error(...args: any[]): void {
        this.log(Levels.ERROR, null, ...args);
    }
    static warn(...args: any[]): void {
        this.log(Levels.WARN, null, ...args);
    }
    static info(...args: any[]): void {
        this.log(Levels.INFO, null, ...args);
    }
    static success(...args: any[]): void {
        this.log(Levels.SUCCESS, null, ...args);
    }
    static default_log(...args: any[]): void {
        this.log(Levels.INFO, null, ...args);
    }
    static debug(...args: any[]): void {
        this.log(Levels.DEBUG, null, ...args);
    }

    static logCustomLevel(levelName: string, without: boolean = true, color?: Colors, ...args: any[]): void {
        const normalized = this.normalizeLevelName(levelName);
        const lvl = normalized as Levels;

        if (without) {
            this.logWithout(lvl, color, ...args);
        } else {
            this.log(lvl, color, ...args);
        }
    }

    static logWithout(level: Levels, colors?: Colors, ...args: any[]): void {
        this.log(level, colors, ...args);
    }

    static log(level: Levels, colors?: Colors | null, ...args: any[]): void {
        let output = "";
        for (const arg of args) {
            const msg =
                arg instanceof Error ? arg.stack : typeof arg === "string" ? arg : JSON.stringify(arg, null, 2);
            if (msg) output += this.formatLog(level, msg, colors) + "\n";
        }
        this.writeStatic(output);
    }

    static async ask(question: string, defaultValue?: string): Promise<string> {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const defaultPart = defaultValue ? ` ${Colors.Dim}${Colors.FgGray}(${defaultValue})${Colors.Reset}` : "";
        const prompt =
            ` ${Colors.FgCyan}${Colors.Bright}◆${Colors.Reset} ${Colors.Bright}${question}${Colors.Reset}${defaultPart}\n` +
            ` ${Colors.FgCyan}❯${Colors.Reset} `;

        return new Promise((resolve) => {
            rl.question(prompt, (ans) => {
                rl.close();
                const value = ans.trim();
                resolve(value === "" && defaultValue !== undefined ? defaultValue : value);
            });
        });
    }

    static async confirm(message: string, defaultYes = false): Promise<boolean> {
        const suffix = defaultYes ? "Y/n" : "y/N";
        const ans = (await this.ask(`${message} ${Colors.Dim}${Colors.FgGray}[${suffix}]${Colors.Reset}`)).toLowerCase();
        if (ans === "") return defaultYes;
        return ["y", "yes", "s", "sim"].includes(ans);
    }

    static table(data: Record<string, any> | Array<{ Field: string; Value: any }>): void {
        let rows: Array<{ Field: string; Value: any }>;
        if (Array.isArray(data)) {
            rows = data.map((row) => ({ Field: String(row.Field), Value: String(row.Value) }));
        } else {
            rows = Object.entries(data).map(([Field, Value]) => ({ Field, Value: String(Value) }));
        }

        const fieldLen = Math.max(...rows.map((r) => r.Field.length), "Field".length);
        const valueLen = Math.max(...rows.map((r) => r.Value.length), "Value".length);

        const h_line = "─".repeat(fieldLen + 2);
        const v_line = "─".repeat(valueLen + 2);

        const top = `┌${h_line}┬${v_line}┐`;
        const mid = `├${h_line}┼${v_line}┤`;
        const bottom = `└${h_line}┴${v_line}┘`;

        const headFg = this.fg(120, 230, 255);
        const headBg = this.bg(18, 56, 64);

        let output = `${Colors.Dim}${Colors.FgGray}${top}${Colors.Reset}\n`;
        output += `${Colors.Dim}${Colors.FgGray}│${Colors.Reset} ${headBg}${headFg}${Colors.Bright}${"Field".padEnd(fieldLen)}${Colors.Reset} ${Colors.Dim}${Colors.FgGray}│${Colors.Reset} ${headBg}${headFg}${Colors.Bright}${"Value".padEnd(valueLen)}${Colors.Reset} ${Colors.Dim}${Colors.FgGray}│${Colors.Reset}\n`;
        output += `${Colors.Dim}${Colors.FgGray}${mid}${Colors.Reset}\n`;

        for (const row of rows) {
            output += `${Colors.Dim}${Colors.FgGray}│${Colors.Reset} ${Colors.FgAlmostWhite}${row.Field.padEnd(fieldLen)}${Colors.Reset} ${Colors.Dim}${Colors.FgGray}│${Colors.Reset} ${Colors.FgAlmostWhite}${row.Value.padEnd(valueLen)}${Colors.Reset} ${Colors.Dim}${Colors.FgGray}│${Colors.Reset}\n`;
        }

        output += `${Colors.Dim}${Colors.FgGray}${bottom}${Colors.Reset}\n`;
        this.writeStatic(output);
    }

    static dynamicLine(initialContent: string): DynamicLine {
        return new DynamicLine(initialContent);
    }

    private static registerDynamicLine(id: symbol, content: string): void {
        this.hook();

        const formatted = this.formatLog("WAIT", content);
        const rows = this.countRowsAdded(formatted + "\n");

        this.writeStatic(formatted);
        this.activeLines.set(id, { offset: rows });
    }

    private static updateDynamicLine(id: symbol, newContent: string): void {
        this.editLine(id, newContent, "WAIT");
    }

    private static endDynamicLine(id: symbol, finalContent: string): void {
        if (this.activeLines.has(id)) {
            this.editLine(id, finalContent, Levels.SUCCESS);
            this.activeLines.delete(id);
        }
    }

    private static editLine(id: symbol, content: string, level: string | Levels): void {
        const line = this.activeLines.get(id);
        if (!line) return;

        const stream = process.stdout;
        const formatted = this.formatLog(level, content);

        this.isWriting = true;

        try {
            readline.moveCursor(stream, 0, -line.offset);

            readline.clearLine(stream, 0);
            readline.cursorTo(stream, 0);
            stream.write(formatted + "\n");

            const newRows = this.countRowsAdded(formatted + "\n");
            const rowsToMoveDown = line.offset - newRows;

            if (rowsToMoveDown > 0) {
                readline.moveCursor(stream, 0, rowsToMoveDown);
            } else if (rowsToMoveDown < 0) {
                readline.moveCursor(stream, 0, rowsToMoveDown);
            }
        } catch (e) {
            // ignore
        }

        this.isWriting = false;
    }
}