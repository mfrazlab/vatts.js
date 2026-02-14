import React, { useMemo } from 'react';

export interface ServerErrorProps {
    title?: string;
    error?: unknown;
    hint?: string;
    requestUrl?: string;
}

function formatUnknownError(error: unknown): { message: string; stack?: string } {
    if (!error) return { message: 'Erro desconhecido no SSR.' };

    if (error instanceof Error) {
        return { message: error.message || String(error), stack: error.stack };
    }

    if (typeof error === 'string') {
        return { message: error };
    }

    try {
        return { message: JSON.stringify(error, null, 2) };
    } catch {
        return { message: String(error) };
    }
}

// Styles definidos como string para facilitar o uso sem arquivos CSS externos
const styles = `
  .ssr-error-wrapper {
    /* PALETA: React Theme (Igual ao BuildingScreen) */
    --react-cyan: #61DAFB;
    --react-dark: #20232a;
    --bg-solid: #000000;
    --card-bg: #0a0a0a;
    --text-main: #ffffff;
    --text-muted: #8ea9c7; /* Azulado acinzentado */
    --error-red: #ff5f56;  /* Mantido vermelho para indicar ERRO crítico */

    font-family: 'Inter', system-ui, sans-serif;
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: var(--bg-solid);
    color: var(--text-main);
    overflow: hidden;
    z-index: 9999;
    box-sizing: border-box;
  }

  .ssr-error-wrapper .container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
    padding: 20px;
    box-sizing: border-box;
  }

  .ssr-error-wrapper .card {
    width: 100%;
    max-width: 900px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    background: var(--card-bg);
    /* Borda sutil ciano */
    box-shadow: 0 0 0 1px rgba(97, 218, 251, 0.1), 0 40px 80px -20px rgba(0, 0, 0, 0.9);
    border-radius: 20px;
    overflow: hidden;
    position: relative;
  }

  .ssr-error-wrapper .neon-line {
    height: 1px;
    width: 100%;
    /* Gradiente Azul/Ciano */
    background: linear-gradient(90deg, transparent, var(--react-dark), var(--react-cyan), var(--react-dark), transparent);
    box-shadow: 0 0 15px rgba(97, 218, 251, 0.2);
    flex-shrink: 0;
  }

  .ssr-error-wrapper .content {
    padding: 32px 40px;
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
  }

  .ssr-error-wrapper h1 {
    margin: 0 0 24px 0;
    font-size: 1.8rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    /* Gradiente Texto: Branco para Cyan */
    background: linear-gradient(180deg, #ffffff 0%, var(--react-cyan) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .ssr-error-wrapper .icon {
    -webkit-text-fill-color: initial;
    font-size: 1.5rem;
  }

  .ssr-error-wrapper .meta-info {
    margin-bottom: 24px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ssr-error-wrapper .meta-row {
    display: flex;
    align-items: baseline;
    gap: 10px;
    font-size: 0.9rem;
  }

  .ssr-error-wrapper .meta-label {
    color: var(--react-cyan); /* Label agora é Ciano */
    font-weight: 700;
    font-size: 0.75rem;
    letter-spacing: 0.05em;
    opacity: 0.8;
  }

  .ssr-error-wrapper .meta-value {
    color: var(--text-muted);
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85rem;
    word-break: break-all;
  }

  .ssr-error-wrapper .meta-value.accent {
    color: var(--react-cyan);
  }

  .ssr-error-wrapper .terminal-box {
    background: rgba(10, 10, 10, 0.8);
    /* Borda e fundo sutilmente azulados */
    border: 1px solid rgba(97, 218, 251, 0.15);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
    font-family: 'JetBrains Mono', monospace;
  }

  .ssr-error-wrapper .terminal-header {
    background: rgba(97, 218, 251, 0.05);
    padding: 12px 16px;
    border-bottom: 1px solid rgba(97, 218, 251, 0.1);
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .ssr-error-wrapper .dots {
    display: flex;
    gap: 6px;
  }

  .ssr-error-wrapper .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  .ssr-error-wrapper .dot.red { background: #ff5f56; }
  .ssr-error-wrapper .dot.yellow { background: #ffbd2e; }
  .ssr-error-wrapper .dot.green { background: #27c93f; }

  .ssr-error-wrapper .terminal-title {
    font-size: 0.75rem;
    color: rgba(255,255,255,0.3);
  }

  .ssr-error-wrapper .terminal-body {
    padding: 20px;
    overflow-y: auto;
    color: #e0e0e0;
    font-size: 0.85rem;
    line-height: 1.6;
  }

  .ssr-error-wrapper .log-entry.error {
    color: #ff8b8b; /* Vermelho claro para erro */
    font-weight: 600;
    margin-bottom: 16px;
  }

  .ssr-error-wrapper .arrow {
    color: var(--react-cyan);
    margin-right: 8px;
  }

  .ssr-error-wrapper .separator {
    height: 1px;
    background: rgba(255,255,255,0.1);
    margin: 16px 0;
    width: 100%;
  }

  .ssr-error-wrapper .stack-trace {
    color: rgba(142, 169, 199, 0.6); /* Azulado mudo */
    white-space: pre-wrap;
    font-size: 0.75rem;
    line-height: 1.5;
  }

  .ssr-error-wrapper .custom-scroll::-webkit-scrollbar {
    width: 8px;
  }
  .ssr-error-wrapper .custom-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .ssr-error-wrapper .custom-scroll::-webkit-scrollbar-thumb {
    background: rgba(97, 218, 251, 0.2);
    border-radius: 4px;
  }
  .ssr-error-wrapper .custom-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(97, 218, 251, 0.4);
  }

  .ssr-error-wrapper .card-footer {
    padding: 16px 40px;
    background: rgba(97, 218, 251, 0.02);
    border-top: 1px solid rgba(97, 218, 251, 0.05);
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    box-sizing: border-box;
  }

  .ssr-error-wrapper .footer-hint {
    color: rgba(255, 255, 255, 0.3);
  }

  .ssr-error-wrapper .status-error {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--error-red);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .ssr-error-wrapper .status-dot {
    width: 6px;
    height: 6px;
    background-color: var(--error-red);
    border-radius: 50%;
    box-shadow: 0 0 8px var(--error-red);
  }

  .ssr-error-wrapper .brand-link {
    margin-top: 24px;
    opacity: 0.4;
  }

  .ssr-error-wrapper .brand-text {
    font-family: 'Inter', sans-serif;
    font-size: 14px;
    font-weight: 600;
    color: #fff;
  }

  .ssr-error-wrapper .brand-highlight {
    color: var(--react-cyan);
  }
`;

export default function ServerError({
                                        title = 'SSR Error',
                                        error,
                                        hint,
                                        requestUrl,
                                    }: ServerErrorProps) {
    const { message, stack } = useMemo(() => formatUnknownError(error), [error]);

    return (
        <>
            <style>{styles}</style>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

            <div className="ssr-error-wrapper">
                <div className="container">
                    <div className="card">
                        {/* Linha Neon Azul */}
                        <div className="neon-line"></div>

                        <div className="content">
                            {/* Cabeçalho */}
                            <h1>
                                {title}
                            </h1>

                            {/* Informações Meta */}
                            {(requestUrl || hint) && (
                                <div className="meta-info">
                                    {requestUrl && (
                                        <div className="meta-row">
                                            <span className="meta-label">REQUEST URL:</span>
                                            <code className="meta-value">{requestUrl}</code>
                                        </div>
                                    )}
                                    {hint && (
                                        <div className="meta-row">
                                            <span className="meta-label">HINT:</span>
                                            <span className="meta-value accent">{hint}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Terminal */}
                            <div className="terminal-box">
                                <div className="terminal-header">
                                    <div className="dots">
                                        <div className="dot red"></div>
                                        <div className="dot yellow"></div>
                                        <div className="dot green"></div>
                                    </div>
                                    <span className="terminal-title">SSR Exception Log</span>
                                </div>

                                <div className="terminal-body custom-scroll">
                                    <div className="log-entry error">
                                        <span className="arrow">{'>'}</span> {message}
                                    </div>

                                    {stack && (
                                        <>
                                            <div className="separator"></div>
                                            <div className="stack-trace">{stack}</div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Rodapé */}
                        <div className="card-footer">

                            <div className="status-error">
                                <div className="status-dot"></div>
                                <span>Render Failed</span>
                            </div>
                        </div>
                    </div>


                </div>
            </div>
        </>
    );
}