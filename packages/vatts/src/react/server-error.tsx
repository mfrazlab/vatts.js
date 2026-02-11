import React from 'react';

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

export default function ServerError({
    title = 'Erro no Server-Side Renderer',
    error,
    hint,
    requestUrl,
}: ServerErrorProps) {
    const { message, stack } = formatUnknownError(error);

    return (
        <div
            style={{
                fontFamily:
                    'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji',
                padding: 24,
                color: '#0f172a',
                background: '#ffffff',
            }}
        >
            <div style={{ maxWidth: 980, margin: '0 auto' }}>
                <h1 style={{ fontSize: 20, margin: 0 }}>{title}</h1>
                {requestUrl ? (
                    <p style={{ marginTop: 8, marginBottom: 0, color: '#334155' }}>
                        URL: <code style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>{requestUrl}</code>
                    </p>
                ) : null}

                {hint ? <p style={{ marginTop: 8, color: '#334155' }}>{hint}</p> : null}

                <div
                    style={{
                        marginTop: 16,
                        padding: 16,
                        border: '1px solid #e2e8f0',
                        borderRadius: 10,
                        background: '#f8fafc',
                    }}
                >
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Mensagem</div>
                    <pre
                        style={{
                            whiteSpace: 'pre-wrap',
                            overflowWrap: 'anywhere',
                            margin: 0,
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                            fontSize: 13,
                        }}
                    >
                        {message}
                    </pre>

                    {stack ? (
                        <>
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 16, marginBottom: 8 }}>Stack</div>
                            <pre
                                style={{
                                    whiteSpace: 'pre-wrap',
                                    overflowWrap: 'anywhere',
                                    margin: 0,
                                    fontFamily:
                                        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                    fontSize: 12,
                                    color: '#334155',
                                }}
                            >
                                {stack}
                            </pre>
                        </>
                    ) : null}
                </div>

                <p style={{ marginTop: 16, color: '#475569', fontSize: 13 }}>
                    Dica: em desenvolvimento isso aparece para debugar. Em produção o SSR falha de forma silenciosa e o
                    cliente assume a renderização.
                </p>
            </div>
        </div>
    );
}
