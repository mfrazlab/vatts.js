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

    // --- GLOBAL STYLES ---
    const globalStyles = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=JetBrains+Mono:wght@400;500&display=swap');

        body {
            margin: 0;
            padding: 0;
            background-color: #0d0d0d; 
            color: #e2e8f0;
            font-family: 'Inter', system-ui, sans-serif;
            overflow: hidden;
            height: 100vh;
            width: 100vw;
        }

        * { box-sizing: border-box; }
    `;

    // --- INLINE STYLES ---

    // Definindo a nova paleta de cores (Vermelho/Laranja)
    const primaryColor = '#ff6b35'; // Cor principal vibrante
    const primaryColorDark = '#e85d04'; // Para gradientes
    const primaryRgb = '255, 107, 53'; // Para usar em rgba()

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
        background: '#0d0d0d',
    };

    const cardStyle: React.CSSProperties = {
        width: 'min(90%, 500px)',
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(10, 10, 12, 0.95)',
        // COR ALTERADA: Borda sutil laranja
        boxShadow: `0 0 0 1px rgba(${primaryRgb}, 0.15), 0 40px 80px -20px rgba(0, 0, 0, 0.8)`,
        borderRadius: 20,
        overflow: 'hidden',
        position: 'relative',
    };

    const neonLine: React.CSSProperties = {
        height: '1px',
        width: '100%',
        // COR ALTERADA: Gradiente laranja/vermelho
        background: `linear-gradient(90deg, transparent, ${primaryColorDark}, ${primaryColor}, transparent)`,
        // COR ALTERADA: Brilho laranja
        boxShadow: `0 0 15px rgba(${primaryRgb}, 0.6)`,
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
        background: 'linear-gradient(180deg, #ffffff 0%, #94a3b8 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        marginBottom: 16,
        // COR ALTERADA: Sombra do texto 404
        filter: `drop-shadow(0 0 20px rgba(${primaryRgb}, 0.15))`,
    };

    const terminalBoxStyle: React.CSSProperties = {
        width: '100%',
        background: 'rgba(0, 0, 0, 0.4)',
        borderRadius: 12,
        padding: '16px',
        marginBottom: 24,
        border: '1px solid rgba(255, 255, 255, 0.05)',
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 12,
        textAlign: 'left',
        color: '#94a3b8',
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
            transition: 'background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
            border: 'none',
            outline: 'none',
            textDecoration: 'none',
            fontFamily: 'Inter, sans-serif',
        };

        if (kind === 'primary') {
            // COR ALTERADA: Estilos do botão primário para laranja
            return {
                ...base,
                background: hovering ? `rgba(${primaryRgb}, 0.15)` : `rgba(${primaryRgb}, 0.1)`,
                color: primaryColor,
                boxShadow: hovering ? `0 0 20px rgba(${primaryRgb}, 0.25)` : `inset 0 0 0 1px rgba(${primaryRgb}, 0.2)`,
            };
        }
        return {
            ...base,
            background: hovering ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
            color: hovering ? '#fff' : 'rgba(255, 255, 255, 0.6)',
            border: '1px solid transparent',
            borderColor: hovering ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
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
                            <div style={{ display: 'flex', gap: 6, marginBottom: 8, opacity: 0.5 }}>
                                <div style={{width: 8, height: 8, borderRadius: '50%', background: '#f87171'}}/>
                                <div style={{width: 8, height: 8, borderRadius: '50%', background: '#fbbf24'}}/>
                                <div style={{width: 8, height: 8, borderRadius: '50%', background: '#4ade80'}}/>
                            </div>
                            <div>
                                <span style={{ color: '#c084fc' }}>GET</span>{' '}
                                {/* COR ALTERADA: O caminho (path) agora é laranja */}
                                <span style={{ color: primaryColor }}>{path}</span>
                            </div>
                            <div style={{ marginTop: 4, color: '#f87171' }}>
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
                        background: 'rgba(0,0,0,0.3)',
                        borderTop: '1px solid rgba(255,255,255,0.03)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.2)'
                    }}>
                        <span>Vatts Server</span>
                        <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                <line x1="12" y1="9" x2="12" y2="13" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                            <span style={{ color: '#f87171' }}>Not Found</span>
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
                    <img src="https://raw.githubusercontent.com/mfrazlab/vatts.js/master/docs/public/logo-v.png" alt="Vatts Logo" style={{ width: 20, height: 20 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: primaryColor }}>
                        Vatts
                        {/* COR ALTERADA: O ".js" agora é laranja */}
                        <span style={{ color: "white" }}>.js</span>
                    </span>
                </a>
            </div>
        </div>
    );
}