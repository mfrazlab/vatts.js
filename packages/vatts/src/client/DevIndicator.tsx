import React, {useEffect, useState} from "react";

export default function DevIndicator({
                                 hasBuildError = false,
                                 onClickBuildError,
                             }: {
    hasBuildError?: boolean;
    onClickBuildError?: () => void;
}) {
    const [isVisible, setIsVisible] = useState(true);
    const [hotState, setHotState] = useState<'idle' | 'reloading'>('idle');

    useEffect(() => {
        const handler = (ev: any) => {
            const detail = ev?.detail;
            if (!detail || !detail.state) return;

            if (detail.state === 'reloading') {
                setHotState('reloading');
            }

            if (detail.state === 'idle') {
                setHotState('idle');
            }

            // Em casos de full reload, pode ficar como reloading até recarregar a página
            if (detail.state === 'full-reload') {
                setHotState('reloading');
            }
        };

        window.addEventListener('vatts:hotreload' as any, handler);
        return () => window.removeEventListener('vatts:hotreload' as any, handler);
    }, []);

    if (!isVisible) return null;

    const isReloading = hotState === 'reloading';
    const isError = !!hasBuildError;

    return (
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
  z-index: 999999;
  
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  background: rgba(15, 15, 20, 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);

  border-radius: 10px;
  color: #fff;
  font-family: 'Inter', ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.05em;

  border: 1px solid rgba(255, 107, 53, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  transition: all 0.2s ease;
  cursor: default;
  user-select: none;
}

.vatts-dev-badge.clickable {
  cursor: pointer;
}

.vatts-dev-badge:hover {
  /* COR ALTERADA: Hover com brilho laranja */
  border-color: rgba(255, 107, 53, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 10px 40px rgba(255, 107, 53, 0.15);
}

/* Mantemos as cores semânticas (Verde = OK, Vermelho = Erro) pois são padrões de status */
.vatts-status-dot {
  width: 8px;
  height: 8px;
  background: #10b981; /* Verde esmeralda */
  border-radius: 50%;
  box-shadow: 0 0 10px #10b981;
  animation: vatts-pulse 2s infinite ease-in-out;
}

.vatts-status-dot.reloading {
  background: #f59e0b; /* Amber */
  box-shadow: 0 0 10px #f59e0b;
}

.vatts-status-dot.error {
  background: #ef4444; /* Red */
  box-shadow: 0 0 12px #ef4444;
  animation: vatts-pulse 1.2s infinite ease-in-out;
}

.vatts-spinner {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.25);
  border-top-color: rgba(255,255,255,0.85);
  animation: vatts-spin 0.8s linear infinite;
}

.vatts-logo {
  /* COR ALTERADA: Gradiente da Logo para Vermelho/Laranja */
  background: linear-gradient(135deg, #ff6b35, #e85d04);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-weight: 800;
}

.vatts-error-pill {
  margin-left: 6px;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(239, 68, 68, 0.18);
  border: 1px solid rgba(239, 68, 68, 0.35);
  color: rgba(255,255,255,0.9);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
    `}
            </style>

            <div
                className={`vatts-dev-badge${isError ? ' clickable' : ''}`}
                title={isError ? 'Build com erro — clique para ver detalhes' : undefined}
                onClick={() => {
                    if (isError) {
                        onClickBuildError?.();
                    }
                }}
            >
                {isReloading ? (
                    <div className="vatts-spinner" />
                ) : (
                    <div className={`vatts-status-dot${isReloading ? ' reloading' : ''}${isError ? ' error' : ''}`} />
                )}
                <div>
                    <span className="vatts-logo">VATTS.JS</span>
                    {isError ? <span className="vatts-error-pill">ERROR</span> : null}
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsVisible(false);
                    }}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255,255,255,0.3)',
                        cursor: 'pointer',
                        fontSize: '14px',
                        padding: '0 0 0 4px',
                        marginLeft: '4px'
                    }}
                    title="Fechar"
                >
                    ×
                </button>
            </div>
        </>
    );
}