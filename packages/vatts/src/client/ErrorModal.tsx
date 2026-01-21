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

// --- ANSI PARSER LOGIC ---
const ANSI_COLORS: Record<string, string> = {
    '30': '#94a3b8',
    '31': '#f87171',
    '32': '#4ade80',
    '33': '#facc15',
    '34': '#60a5fa',
    '35': '#c084fc',
    '36': '#ff6b35', // Alterado de Cyan para Laranja
    '37': '#e2e8f0',
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

    // Definição das novas cores
    const primaryColor = '#ff6b35';
    const primaryColorDark = '#e85d04';
    const primaryRgb = '255, 107, 53';

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
        background: visible ? 'rgba(5, 5, 5, 0.98)' : 'rgba(5, 5, 5, 0)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        transition: 'background 0.3s ease, opacity 0.3s ease',
        opacity: visible ? 1 : 0,
        boxSizing: 'border-box',
    };

    const cardStyle: React.CSSProperties = {
        width: '100%',
        maxWidth: '1080px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(10, 10, 12, 1)',
        // COR ALTERADA: Sombra laranja
        boxShadow: `0 0 0 1px rgba(${primaryRgb}, 0.15), 0 50px 100px -20px rgba(0, 0, 0, 1)`,
        borderRadius: 16,
        overflow: 'hidden',
        transform: visible ? 'scale(1) translateY(0)' : 'scale(0.98) translateY(10px)',
        transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        position: 'relative',
    };

    const neonLine: React.CSSProperties = {
        height: '1px',
        width: '100%',
        // COR ALTERADA: Gradiente Laranja/Vermelho
        background: `linear-gradient(90deg, transparent, ${primaryColorDark}, ${primaryColor}, transparent)`,
        boxShadow: `0 0 15px rgba(${primaryRgb}, 0.6)`,
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
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize: 13,
        lineHeight: 1.6,
        color: '#e2e8f0',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
    };

    const getBtnStyle = (kind: 'primary' | 'secondary', hovering: boolean): React.CSSProperties => {
        const base: React.CSSProperties = {
            padding: '8px 14px',
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            border: 'none',
            outline: 'none',
            fontFamily: 'system-ui, sans-serif'
        };

        if (kind === 'primary') {
            return {
                ...base,
                // COR ALTERADA: Botão primário laranja
                background: hovering ? `rgba(${primaryRgb}, 0.15)` : 'transparent',
                color: primaryColor,
                border: `1px solid rgba(${primaryRgb}, 0.3)`,
                boxShadow: hovering ? `0 0 10px rgba(${primaryRgb}, 0.2)` : 'none',
            };
        }
        return {
            ...base,
            background: 'transparent',
            color: hovering ? '#fff' : 'rgba(255,255,255,0.5)',
        };
    };

    const modalContent = (
        <div style={overlayStyle} onMouseDown={onClose}>
            <div style={cardStyle} onMouseDown={(e) => e.stopPropagation()}>
                <div style={neonLine} />

                <div style={headerStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                         <span style={{
                             fontSize: 12,
                             fontWeight: 800,
                             color: '#f87171',
                             letterSpacing: '0.1em'
                         }}>
                            ERROR
                        </span>
                        {error.plugin && (
                            <span style={{
                                fontSize: 11,
                                color: 'rgba(255,255,255,0.3)',
                                background: 'rgba(255,255,255,0.05)',
                                padding: '2px 6px',
                                borderRadius: 4,
                                fontFamily: 'monospace'
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
                        <div style={{ marginTop: 24, opacity: 0.6, borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: 16 }}>
                            <AnsiText text={stackOutput} />
                        </div>
                    )}
                </div>

                <div style={{
                    padding: '8px 24px',
                    background: 'rgba(0,0,0,0.3)',
                    borderTop: '1px solid rgba(255,255,255,0.03)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.2)'
                }}>
                    <span>vatts-cli</span>
                    {/* COR ALTERADA: Status text laranja */}
                    <span style={{ color: primaryColor }}>Watching for changes...</span>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}