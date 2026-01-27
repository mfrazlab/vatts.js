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
            /* PALETA: Monocromática estilo Next.js */
            --primary: #ffffff;
            --primary-glow: rgba(255, 255, 255, 0.1);
            --text-main: #ffffff;
            --text-muted: #64748b;
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
            /* Borda sutil em cinza escuro */
            box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1), 0 40px 80px -20px rgba(0, 0, 0, 0.9);
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
            /* Linha de luz branca/cinza */
            background: linear-gradient(90deg, transparent, #334155, #ffffff, #334155, transparent);
            box-shadow: 0 0 15px rgba(255, 255, 255, 0.05);
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
            /* Deixa a logo levemente dessaturada para combinar */
            filter: grayscale(0.5);
        }

        .logo-glow {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 100%;
            height: 100%;
            background: #ffffff;
            filter: blur(25px);
            opacity: 0.1;
            border-radius: 50%;
            animation: pulse 2s ease-in-out infinite;
        }

        h1 {
            margin: 0;
            font-size: 2rem;
            font-weight: 800;
            letter-spacing: -0.03em;
            background: linear-gradient(180deg, #ffffff 0%, #475569 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        h1 span {
            color: #475569;
            -webkit-text-fill-color: #475569;
        }

        p {
            margin: 8px 0 32px 0;
            color: var(--text-muted);
            font-size: 0.9rem;
            font-weight: 500;
        }

        .terminal-box {
            width: 100%;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            padding: 16px;
            text-align: left;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.75rem;
            color: #475569;
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
            border: 2px solid rgba(255, 255, 255, 0.1);
            border-top-color: #ffffff;
            border-radius: 50%;
            animation: spin 0.6s linear infinite;
        }

        .file-name { color: #94a3b8; }
        .accent { color: #ffffff; }

        .card-footer {
            width: 100%;
            padding: 12px 32px;
            background: rgba(255,255,255,0.02);
            border-top: 1px solid rgba(255,255,255,0.05);
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11px;
            color: rgba(255,255,255,0.2);
            box-sizing: border-box;
        }

        .status-active {
            display: flex;
            align-items: center;
            gap: 6px;
            color: #ffffff;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .dot {
            width: 6px;
            height: 6px;
            background-color: #ffffff;
            border-radius: 50%;
            box-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
        }

        @keyframes pulse {
            0%, 100% { opacity: 0.1; transform: translate(-50%, -50%) scale(1); }
            50% { opacity: 0.15; transform: translate(-50%, -50%) scale(1.1); }
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
                        <img src="https://raw.githubusercontent.com/mfrazlab/vatts.js/master/docs/public/logo.png" alt="Vatts Logo" />
                    </div>

                    <h1>Vatts<span>.js</span></h1>
                    <p>Building your application...</p>

                    <div className="terminal-box">
                        <div className="term-line">
                            <div className="term-spinner"></div>
                            <span className="file-name">Compiling <span className="accent">src/vatts.ts</span>...</span>
                        </div>
                        <div className="term-line" style={{ opacity: 0.5 }}>
                            <span>✓</span>
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