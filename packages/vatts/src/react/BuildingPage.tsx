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
import React from "react";

export default function BuildingScreen() {
    let version = "1.0.0";
    try {
        version = require("../package.json").version;
    } catch (e) {}

    const styles = `
        :root {
            --bg-solid: #000000;
            --card-bg: #0a0a0a;
            /* PALETA: React Theme */
            --react-cyan: #61DAFB;      /* O azul/ciano clássico do React */
            --react-dark: #20232a;      /* Fundo escuro azulado */
            --primary: #ffffff;
            --primary-glow: rgba(97, 218, 251, 0.1);
            --text-main: #ffffff;
            --text-muted: #8ea9c7;      /* Cinza azulado para combinar */
        }

        body {
            margin: 0;
            padding: 0;
            width: 100vw;
            height: 100vh;
            background-color: var(--bg-solid);
            font-family: 'Inter', sans-serif;
            color: var(--text-main);
            overflow: hidden;
            position: relative;
        }

        .container {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            display: flex;
            justify-content: center;
            align-items: center;
            width: 100%;
            pointer-events: none;
        }

        .build-card {
            pointer-events: auto;
            position: relative;
            width: 100%;
            max-width: 420px;
            background: var(--card-bg);
            /* Borda sutil com brilho React Cyan */
            box-shadow: 0 0 0 1px rgba(97, 218, 251, 0.1), 0 40px 80px -20px rgba(0, 0, 0, 0.9);
            border-radius: 20px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
        }

        .neon-line {
            height: 1px;
            width: 100%;
            /* Linha de luz: Gradiente usando o Cyan */
            background: linear-gradient(90deg, transparent, var(--react-dark), var(--react-cyan), var(--react-dark), transparent);
            box-shadow: 0 0 15px rgba(97, 218, 251, 0.2);
        }

        .content {
            padding: 40px 32px;
            width: 100%;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .logo-wrapper {
            position: relative;
            margin-bottom: 24px;
        }
        
        .logo-wrapper img {
            width: 64px;
            height: 64px;
            object-fit: contain;
            position: relative;
            z-index: 2;
            /* Removi o grayscale para a logo brilhar na cor natural se tiver cor, ou ficar nítida */
            filter: none;
        }

        .logo-glow {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 100%;
            height: 100%;
            /* Glow Cyan do React */
            background: var(--react-cyan);
            filter: blur(25px);
            opacity: 0.2;
            border-radius: 50%;
            animation: pulse 2s ease-in-out infinite;
        }

        h1 {
            margin: 0;
            font-size: 2rem;
            font-weight: 800;
            letter-spacing: -0.03em;
            /* Gradiente do texto: Branco para Cyan */
            background: linear-gradient(180deg, #ffffff 0%, var(--react-cyan) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        h1 span {
            /* Span .js em Cyan Sólido */
            color: var(--react-cyan);
            -webkit-text-fill-color: var(--react-cyan);
        }

        p {
            margin: 8px 0 32px 0;
            color: var(--text-muted);
            font-size: 0.9rem;
            font-weight: 500;
        }

        .terminal-box {
            width: 100%;
            background: rgba(97, 218, 251, 0.03); /* Fundo azulado bem sutil */
            border: 1px solid rgba(97, 218, 251, 0.1); /* Borda ciano sutil */
            border-radius: 12px;
            padding: 16px;
            text-align: left;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.75rem;
            color: var(--text-muted);
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .term-line {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .term-spinner {
            width: 10px;
            height: 10px;
            border: 2px solid rgba(97, 218, 251, 0.1);
            border-top-color: var(--react-cyan); /* Spinner Cyan */
            border-radius: 50%;
            animation: spin 0.6s linear infinite;
        }

        .file-name { color: #8ea9c7; }
        .accent { color: var(--react-cyan); }

        .card-footer {
            width: 100%;
            padding: 12px 32px;
            background: rgba(97, 218, 251, 0.02);
            border-top: 1px solid rgba(97, 218, 251, 0.05);
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11px;
            color: rgba(255,255,255,0.3);
            box-sizing: border-box;
        }

        .status-active {
            display: flex;
            align-items: center;
            gap: 6px;
            color: var(--react-cyan);
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .dot {
            width: 6px;
            height: 6px;
            background-color: var(--react-cyan);
            border-radius: 50%;
            box-shadow: 0 0 8px var(--react-cyan);
        }

        @keyframes pulse {
            0%, 100% { opacity: 0.15; transform: translate(-50%, -50%) scale(1); }
            50% { opacity: 0.25; transform: translate(-50%, -50%) scale(1.1); }
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    `;

    return (
        <html lang="en">
        <head>
            <meta charSet="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Vatts.js | Building...</title>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
            <style dangerouslySetInnerHTML={{ __html: styles }} />
        </head>
        <body>
        <div className="container">
            <div className="build-card">
                <div className="neon-line"></div>

                <div className="content">
                    <div className="logo-wrapper">
                        <div className="logo-glow"></div>
                        <img src="https://raw.githubusercontent.com/mfrazlab/vatts.js/docs/public/logo.png" alt="Vatts Logo" />
                    </div>

                    <h1>Vatts<span>.js</span></h1>
                    <p>Building your application...</p>

                    <div className="terminal-box">
                        <div className="term-line">
                            <div className="term-spinner"></div>
                            <span className="file-name">Compiling <span className="accent">src/vatts.ts</span>...</span>
                        </div>
                        <div className="term-line" style={{ opacity: 0.5 }}>
                            <span style={{ color: "var(--react-cyan)" }}>✓</span>
                            <span className="file-name">Optimizing assets</span>
                        </div>
                    </div>
                </div>

                <div className="card-footer">
                    <span>Building...</span>
                    <div className="status-active">
                        <div className="dot"></div>
                        v{version}
                    </div>
                </div>
            </div>
        </div>

        <script dangerouslySetInnerHTML={{ __html: `
                setTimeout(() => {
                    window.location.reload();
                }, 2500);
            `}} />
        </body>
        </html>
    );
}