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
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function DevIndicator({
                                         hasBuildError = false,
                                         onClickBuildError,
                                     }: {
    hasBuildError?: boolean;
    onClickBuildError?: () => void;
}) {
    const [isVisible, setIsVisible] = useState(true);
    const [hotState, setHotState] = useState<'idle' | 'reloading'>('idle');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const handler = (ev: any) => {
            const detail = ev?.detail;
            if (!detail || !detail.state) return;

            if (detail.state === 'reloading' || detail.state === 'full-reload') {
                setHotState('reloading');
            }
            if (detail.state === 'idle') {
                setHotState('idle');
            }
        };

        window.addEventListener('vatts:hotreload' as any, handler);
        return () => window.removeEventListener('vatts:hotreload' as any, handler);
    }, []);

    if (!isVisible || !mounted) return null;

    const isReloading = hotState === 'reloading';
    const isError = !!hasBuildError;

    // Criamos o elemento via Portal para injetar no final do <body>
    return createPortal(
        <>
            <style>
                {`
                @keyframes vatts-pulse {
                  0% { opacity: 0.4; }
                  50% { opacity: 1; }
                  100% { opacity: 0.4; }
                }

                @keyframes vatts-spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }

                .vatts-dev-badge {
                  position: fixed;
                  bottom: 20px;
                  right: 20px;
                  /* Z-index absurdo para garantir que fique acima de tudo */
                  z-index: 2147483647; 
                  
                  display: flex;
                  align-items: center;
                  gap: 12px;
                  padding: 8px 14px;
                  background: rgba(0, 0, 0, 0.85);
                  backdrop-filter: blur(12px);
                  -webkit-backdrop-filter: blur(12px);

                  border-radius: 10px;
                  color: #fff;
                  font-family: 'Inter', system-ui, sans-serif;
                  font-size: 11px;
                  font-weight: 600;
                  letter-spacing: 0.05em;

                  /* Estilo Monocromático Next.js */
                  border: 1px solid rgba(255, 255, 255, 0.1);
                  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
                  transition: all 0.2s ease;
                  cursor: default;
                  user-select: none;
                }

                .vatts-dev-badge.clickable {
                  cursor: pointer;
                }

                .vatts-dev-badge:hover {
                  border-color: rgba(255, 255, 255, 0.3);
                  transform: translateY(-2px);
                  background: rgba(10, 10, 10, 0.95);
                }

                .vatts-status-dot {
                  width: 7px;
                  height: 7px;
                  background: #ffffff; /* Branco para status OK (Estilo Vercel) */
                  border-radius: 50%;
                  box-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
                  animation: vatts-pulse 2.5s infinite ease-in-out;
                }

                .vatts-status-dot.reloading {
                  background: #64748b; /* Slate */
                  box-shadow: none;
                }

                .vatts-status-dot.error {
                  background: #ef4444; /* Mantido vermelho por semântica de erro */
                  box-shadow: 0 0 10px #ef4444;
                  animation: vatts-pulse 1s infinite ease-in-out;
                }

                .vatts-spinner {
                  width: 10px;
                  height: 10px;
                  border-radius: 50%;
                  border: 2px solid rgba(255,255,255,0.1);
                  border-top-color: #ffffff;
                  animation: vatts-spin 0.8s linear infinite;
                }

                .vatts-logo {
                  color: #ffffff;
                  font-weight: 800;
                  display: flex;
                  align-items: center;
                }

                .vatts-logo span {
                  color: #64748b;
                }

                .vatts-error-pill {
                  margin-left: 8px;
                  padding: 2px 6px;
                  border-radius: 4px;
                  background: #ffffff;
                  color: #000000;
                  font-size: 9px;
                  font-weight: 900;
                }
                `}
            </style>

            <div
                className={`vatts-dev-badge${isError ? ' clickable' : ''}`}
                onClick={() => isError && onClickBuildError?.()}
            >
                {isReloading ? (
                    <div className="vatts-spinner" />
                ) : (
                    <div className={`vatts-status-dot${isReloading ? ' reloading' : ''}${isError ? ' error' : ''}`} />
                )}

                <div className="vatts-logo">
                    VATTS<span>.JS</span>
                    {isError && <span className="vatts-error-pill">ERROR</span>}
                </div>

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsVisible(false);
                    }}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255,255,255,0.2)',
                        cursor: 'pointer',
                        fontSize: '16px',
                        padding: '0 0 0 4px',
                        marginLeft: '4px',
                        display: 'flex',
                        alignItems: 'center'
                    }}
                >
                    ×
                </button>
            </div>
        </>,
        document.body
    );
}