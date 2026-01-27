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
import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';

export interface VattsBuildError {
    message?: string;
    name?: string;
    stack?: string;
    frame?: string;
    id?: string;
    plugin?: string;
    pluginCode?: string;
    loc?: any;
    watchFiles?: any;
    cause?: any;
    ts?: number;
}

// --- ANSI PARSER LOGIC (Monochrome Adjusted) ---
const ANSI_COLORS: Record<string, string> = {
    '30': '#475569',
    '31': '#ef4444', // Mantido um vermelho sutil para erros no log
    '32': '#ffffff', // Sucesso vira Branco
    '33': '#94a3b8', // Warning vira Cinza
    '34': '#cbd5e1',
    '35': '#e2e8f0',
    '36': '#ffffff', // Accent vira Branco
    '37': '#ffffff',
    '90': '#64748b',
};

function AnsiText({ text }: { text: string }) {
    const parts = useMemo(() => {
        const regex = /\u001b\[(\d+)(?:;\d+)*m/g;
        const result = [];
        let lastIndex = 0;
        let match;
        let currentColor = null;

        while ((match = regex.exec(text)) !== null) {
            const rawText = text.slice(lastIndex, match.index);
            if (rawText) {
                result.push({ text: rawText, color: currentColor });
            }

            const code = match[1];
            if (code === '39' || code === '0') {
                currentColor = null;
            } else if (ANSI_COLORS[code]) {
                currentColor = ANSI_COLORS[code];
            }

            lastIndex = regex.lastIndex;
        }

        const remaining = text.slice(lastIndex);
        if (remaining) {
            result.push({ text: remaining, color: currentColor });
        }

        return result;
    }, [text]);

    return (
        <span>
            {parts.map((part, i) => (
                <span key={i} style={{ color: part.color || 'inherit' }}>
                    {part.text}
                </span>
            ))}
        </span>
    );
}

// --- MAIN MODAL ---

export function ErrorModal({
                               error,
                               isOpen,
                               onClose,
                               onCopy,
                           }: {
    error: VattsBuildError | null;
    isOpen: boolean;
    onClose: () => void;
    onCopy?: () => void;
}) {
    const [visible, setVisible] = useState(false);
    const [isHoveringClose, setIsHoveringClose] = useState(false);
    const [isHoveringCopy, setIsHoveringCopy] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Paleta Next.js
    const primaryColor = '#ffffff';
    const primaryRgb = '255, 255, 255';
    const borderColor = 'rgba(255, 255, 255, 0.1)';

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            setTimeout(() => setVisible(true), 10);
        } else {
            document.body.style.overflow = '';
            setVisible(false);
        }

        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (!mounted || !isOpen || !error) return null;

    const rawOutput = error.message || '';
    const stackOutput = error.stack ? `\n\nStack Trace:\n${error.stack}` : '';

    // --- STYLES ---

    const overlayStyle: React.CSSProperties = {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 2147483647,
        background: visible ? 'rgba(0, 0, 0, 0.95)' : 'rgba(0, 0, 0, 0)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        transition: 'all 0.3s ease',
        opacity: visible ? 1 : 0,
        boxSizing: 'border-box',
    };

    const cardStyle: React.CSSProperties = {
        width: '100%',
        maxWidth: '1080px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#0a0a0a',
        boxShadow: `0 0 0 1px ${borderColor}, 0 50px 100px -20px rgba(0, 0, 0, 1)`,
        borderRadius: 16,
        overflow: 'hidden',
        transform: visible ? 'scale(1) translateY(0)' : 'scale(0.98) translateY(10px)',
        transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        position: 'relative',
    };

    const neonLine: React.CSSProperties = {
        height: '1px',
        width: '100%',
        background: `linear-gradient(90deg, transparent, #334155, #ffffff, #334155, transparent)`,
        boxShadow: `0 0 15px rgba(255, 255, 255, 0.05)`,
    };

    const headerStyle: React.CSSProperties = {
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.01)'
    };

    const terminalContent: React.CSSProperties = {
        padding: 24,
        overflow: 'auto',
        flex: 1,
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 13,
        lineHeight: 1.6,
        color: '#e2e8f0',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
    };

    const getBtnStyle = (kind: 'primary' | 'secondary', hovering: boolean): React.CSSProperties => {
        const base: React.CSSProperties = {
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            border: 'none',
            outline: 'none',
            fontFamily: 'Inter, system-ui, sans-serif'
        };

        if (kind === 'primary') {
            return {
                ...base,
                background: hovering ? '#ffffff' : '#f1f5f9',
                color: '#000000',
                boxShadow: hovering ? `0 0 15px rgba(255, 255, 255, 0.2)` : 'none',
            };
        }
        return {
            ...base,
            background: hovering ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
            color: hovering ? '#fff' : 'rgba(255, 255, 255, 0.4)',
            border: '1px solid transparent',
            borderColor: hovering ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
        };
    };

    const modalContent = (
        <div style={overlayStyle} onMouseDown={onClose}>
            <div style={cardStyle} onMouseDown={(e) => e.stopPropagation()}>
                <div style={neonLine} />

                <div style={headerStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                         <span style={{
                             fontSize: 11,
                             fontWeight: 900,
                             color: '#ffffff',
                             background: '#ef4444',
                             padding: '2px 8px',
                             borderRadius: 4,
                             letterSpacing: '0.05em'
                         }}>
                            ERROR
                        </span>
                        {error.plugin && (
                            <span style={{
                                fontSize: 11,
                                color: '#64748b',
                                background: 'rgba(255, 255, 255, 0.03)',
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontFamily: 'monospace',
                                border: '1px solid rgba(255, 255, 255, 0.05)'
                            }}>
                                {error.plugin}
                            </span>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                        {onCopy && (
                            <button
                                onClick={onCopy}
                                onMouseEnter={() => setIsHoveringCopy(true)}
                                onMouseLeave={() => setIsHoveringCopy(false)}
                                style={getBtnStyle('secondary', isHoveringCopy)}
                            >
                                Copy Log
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            onMouseEnter={() => setIsHoveringClose(true)}
                            onMouseLeave={() => setIsHoveringClose(false)}
                            style={getBtnStyle('primary', isHoveringClose)}
                        >
                            Close
                        </button>
                    </div>
                </div>

                <div style={terminalContent}>
                    <AnsiText text={rawOutput} />
                    {stackOutput && (
                        <div style={{ marginTop: 24, opacity: 0.4, borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: 16 }}>
                            <AnsiText text={stackOutput} />
                        </div>
                    )}
                </div>

                <div style={{
                    padding: '10px 24px',
                    background: 'rgba(255,255,255,0.01)',
                    borderTop: '1px solid rgba(255,255,255,0.03)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.3)',
                    fontFamily: 'Inter, sans-serif'
                }}>
                    <span>vatts-cli</span>
                    <span style={{ color: '#64748b', fontWeight: 500 }}>Watching for changes...</span>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}