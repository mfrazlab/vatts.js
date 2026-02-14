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
import React, { useState, useEffect } from 'react';

export default function ErrorPage() {
    const [path, setPath] = useState('/');
    const [hoverHome, setHoverHome] = useState(false);
    const [hoverRetry, setHoverRetry] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setPath(window.location.pathname);
        }
    }, []);

    // --- CORES DO TEMA REACT ---
    const theme = {
        cyan: '#61DAFB',       // React Blue/Cyan
        dark: '#20232a',       // React Dark BG Accent
        textMuted: '#8ea9c7',  // Azul acinzentado
        bg: '#000000',
        cardBg: '#0a0a0a'
    };

    // --- GLOBAL STYLES ---
    const globalStyles = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=JetBrains+Mono:wght@400;500&display=swap');

        body {
            margin: 0;
            padding: 0;
            background-color: ${theme.bg}; 
            color: #ffffff;
            font-family: 'Inter', system-ui, sans-serif;
            overflow: hidden;
            height: 100vh;
            width: 100vw;
        }

        * { box-sizing: border-box; }
    `;

    // --- INLINE STYLES ---

    const containerStyle: React.CSSProperties = {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100vw',
        height: '100vh',
        background: theme.bg,
    };

    const cardStyle: React.CSSProperties = {
        width: 'min(90%, 500px)',
        display: 'flex',
        flexDirection: 'column',
        background: theme.cardBg,
        // Borda sutil com brilho Cyan
        boxShadow: `0 0 0 1px rgba(97, 218, 251, 0.1), 0 40px 80px -20px rgba(0, 0, 0, 0.9)`,
        borderRadius: 20,
        overflow: 'hidden',
        position: 'relative',
    };

    const neonLine: React.CSSProperties = {
        height: '1px',
        width: '100%',
        // Gradiente usando o Cyan do React
        background: `linear-gradient(90deg, transparent, ${theme.dark}, ${theme.cyan}, ${theme.dark}, transparent)`,
        // Brilho Cyan suave
        boxShadow: `0 0 15px rgba(97, 218, 251, 0.2)`,
    };

    const contentStyle: React.CSSProperties = {
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
    };

    const codeStyle: React.CSSProperties = {
        fontSize: 80,
        fontWeight: 900,
        lineHeight: 1,
        letterSpacing: '-0.04em',
        color: '#fff',
        // Gradiente Branco -> Cyan
        background: `linear-gradient(180deg, #ffffff 0%, ${theme.cyan} 100%)`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        marginBottom: 16,
        filter: `drop-shadow(0 0 20px rgba(97, 218, 251, 0.1))`,
    };

    const terminalBoxStyle: React.CSSProperties = {
        width: '100%',
        background: 'rgba(97, 218, 251, 0.03)', // Fundo azulado sutil
        borderRadius: 12,
        padding: '16px',
        marginBottom: 24,
        border: '1px solid rgba(97, 218, 251, 0.1)', // Borda cyan sutil
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 12,
        textAlign: 'left',
        color: theme.textMuted,
    };

    const getBtnStyle = (kind: 'primary' | 'secondary', hovering: boolean): React.CSSProperties => {
        const base: React.CSSProperties = {
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            border: 'none',
            outline: 'none',
            textDecoration: 'none',
            fontFamily: 'Inter, sans-serif',
        };

        if (kind === 'primary') {
            return {
                ...base,
                // Botão Primário agora é o Cyan do React com texto escuro (contraste alto)
                background: hovering ? '#ffffff' : theme.cyan,
                color: '#000000',
                boxShadow: hovering ? `0 0 20px rgba(97, 218, 251, 0.4)` : 'none',
            };
        }
        return {
            ...base,
            background: hovering ? 'rgba(97, 218, 251, 0.1)' : 'transparent',
            color: hovering ? '#fff' : theme.textMuted,
            border: '1px solid',
            borderColor: hovering ? theme.cyan : 'rgba(255, 255, 255, 0.1)',
        };
    };

    const brandStyle: React.CSSProperties = {
        marginTop: 32,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        opacity: 0.4,
        transition: 'opacity 0.3s',
        textDecoration: 'none',
        color: '#fff',
    };

    return (
        <div >
            <style dangerouslySetInnerHTML={{ __html: globalStyles }} />

            <div style={containerStyle}>
                <div style={cardStyle}>
                    <div style={neonLine} />

                    <div style={contentStyle}>
                        <div style={codeStyle}>404</div>

                        <div style={terminalBoxStyle}>
                            <div style={{ display: 'flex', gap: 6, marginBottom: 8, opacity: 0.3 }}>
                                <div style={{width: 8, height: 8, borderRadius: '50%', background: '#fff'}}/>
                                <div style={{width: 8, height: 8, borderRadius: '50%', background: '#fff'}}/>
                                <div style={{width: 8, height: 8, borderRadius: '50%', background: '#fff'}}/>
                            </div>
                            <div>
                                {/* Método GET em Cyan */}
                                <span style={{ color: theme.cyan }}>GET</span>{' '}
                                <span style={{ color: '#fff' }}>{path}</span>
                            </div>
                            <div style={{ marginTop: 4, color: theme.textMuted }}>
                                <span>Error: Route not found</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                            <a
                                href="/"
                                onMouseEnter={() => setHoverHome(true)}
                                onMouseLeave={() => setHoverHome(false)}
                                style={{ ...getBtnStyle('primary', hoverHome), flex: 1, justifyContent: 'center' }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                    <polyline points="9 22 9 12 15 12 15 22" />
                                </svg>
                                Back Home
                            </a>
                            <button
                                onClick={() => window.location.reload()}
                                onMouseEnter={() => setHoverRetry(true)}
                                onMouseLeave={() => setHoverRetry(false)}
                                style={{ ...getBtnStyle('secondary', hoverRetry), flex: 1, justifyContent: 'center' }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 2v6h-6"></path>
                                    <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
                                    <path d="M3 22v-6h6"></path>
                                    <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
                                </svg>
                                Retry
                            </button>
                        </div>
                    </div>

                    <div style={{
                        padding: '12px 32px',
                        background: 'rgba(97, 218, 251, 0.02)',
                        borderTop: '1px solid rgba(97, 218, 251, 0.05)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.3)'
                    }}>
                        <span>Vatts Server</span>
                        <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                            {/* Ponto de status Cyan */}
                            <div style={{width: 6, height: 6, borderRadius: '50%', background: theme.cyan, boxShadow: `0 0 6px ${theme.cyan}`}} />
                            <span style={{ color: theme.cyan }}>Not Found</span>
                        </div>
                    </div>
                </div>

                <a
                    href="https://npmjs.com/package/vatts"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={brandStyle}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0.4'}
                >
                    {/* Logo mantida, removido o filtro cinza para ficar natural */}
                    <img src="https://raw.githubusercontent.com/mfrazlab/vatts.js/docs/public/logo.png" alt="Vatts Logo" style={{ width: 20, height: 20 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                        Vatts
                        <span style={{ color: theme.cyan }}>.js</span>
                    </span>
                </a>
            </div>
        </div>
    );
}