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
import React, {useState, useEffect, useCallback} from 'react';
import { createRoot, Root } from 'react-dom/client';
import { router } from '../client/clientRouter';
import { ErrorModal, VattsBuildError } from './ErrorModal';
import type {Metadata} from "../types";
import DevIndicator from "./DevIndicator";

// --- O Componente Principal do Cliente (Roteador) ---

interface AppProps {
    componentMap: Record<string, any>;
    routes: { pattern: string; componentPath: string, metadata?: Metadata }[];
    initialComponentPath: string;
    initialParams: any;
    layoutComponent?: any;
}

function App({ componentMap, routes, initialComponentPath, initialParams, layoutComponent }: AppProps) {
    // Estado que guarda o componente a ser renderizado atualmente
    const [hmrTimestamp, setHmrTimestamp] = useState(Date.now());

    // Estado de erro de build recebido pelo hot-reload (via eventos globais)
    const [buildError, setBuildError] = useState<VattsBuildError | null>(() => {
        return (window as any).__VATTS_BUILD_ERROR__ || null;
    });
    const [isErrorOpen, setIsErrorOpen] = useState<boolean>(() => !!(window as any).__VATTS_BUILD_ERROR__);

    useEffect(() => {
        const onErr = (ev: any) => {
            const e = ev?.detail as VattsBuildError;
            setBuildError(e || null);
            setIsErrorOpen(true);
        };
        const onOk = () => {
            setBuildError(null);
            setIsErrorOpen(false);
        };

        window.addEventListener('vatts:build-error' as any, onErr);
        window.addEventListener('vatts:build-ok' as any, onOk);
        return () => {
            window.removeEventListener('vatts:build-error' as any, onErr);
            window.removeEventListener('vatts:build-ok' as any, onOk);
        };
    }, []);

    const copyBuildError = useCallback(async () => {
        try {
            if (!buildError) return;
            const payload = JSON.stringify(buildError, null, 2);
            await navigator.clipboard.writeText(payload);
        } catch {
            // ignore
        }
    }, [buildError]);

    // Helper para encontrar rota baseado no path
    const findRouteForPath = useCallback((path: string) => {
        for (const route of routes) {
            const regexPattern = route.pattern
                // [[...param]] → opcional catch-all
                .replace(/\[\[\.\.\.(\w+)\]\]/g, '(?<$1>.+)?')
                // [...param] → obrigatório catch-all
                .replace(/\[\.\.\.(\w+)\]/g, '(?<$1>.+)')
                // /[[param]] → opcional com barra também opcional
                .replace(/\/\[\[(\w+)\]\]/g, '(?:/(?<$1>[^/]+))?')
                // [[param]] → segmento opcional (sem barra anterior)
                .replace(/\[\[(\w+)\]\]/g, '(?<$1>[^/]+)?')
                // [param] → segmento obrigatório
                .replace(/\[(\w+)\]/g, '(?<$1>[^/]+)');
            const regex = new RegExp(`^${regexPattern}/?$`);
            const match = path.match(regex);
            if (match) {
                return {
                    componentPath: route.componentPath,
                    params: match.groups || {},
                    metadata: route.metadata
                };
            }
        }
        return null;
    }, [routes]);

    // Inicializa o componente e params baseado na URL ATUAL (não no initialComponentPath)
    const [CurrentPageComponent, setCurrentPageComponent] = useState(() => {
        // Pega a rota atual da URL
        const currentPath = window.location.pathname.replace("index.html", '');
        const match = findRouteForPath(currentPath);

        if (match) {
            return componentMap[match.componentPath];
        }

        // Se não encontrou rota, retorna null para mostrar 404
        return null;
    });

    const [params, setParams] = useState(() => {
        // Pega os params da URL atual
        const currentPath = window.location.pathname.replace("index.html", '');
        const match = findRouteForPath(currentPath);
        return match ? match.params : {};
    });

    // HMR: Escuta eventos de hot reload
    useEffect(() => {
        // Ativa o sistema de HMR
        (window as any).__HWEB_HMR__ = true;

        const handleHMRUpdate = async (event: CustomEvent) => {
            const { file, timestamp } = event.detail;
            const fileName = file ? file.split('/').pop()?.split('\\').pop() : 'unknown';
            console.log('🔥 HMR: Component Update Triggered', fileName);

            // Neste modelo onde o script main.js é recarregado por completo,
            // a atualização real acontece via reinicialização do initializeClient.
            // Este listener serve mais para feedback visual ou atualizações parciais se implementadas.

            try {
                setHmrTimestamp(timestamp);
                (window as any).__HMR_SUCCESS__ = true;
                setTimeout(() => {
                    (window as any).__HMR_SUCCESS__ = false;
                }, 3000);
            } catch (error) {
                console.error('❌ HMR Error:', error);
                (window as any).__HMR_SUCCESS__ = false;
            }
        };

        window.addEventListener('hmr:component-update' as any, handleHMRUpdate);

        return () => {
            window.removeEventListener('hmr:component-update' as any, handleHMRUpdate);
        };
    }, []);


    const updateRoute = useCallback(() => {
        const currentPath = router.pathname.replace("index.html", '');
        const match = findRouteForPath(currentPath);
        if (match) {
            setCurrentPageComponent(() => componentMap[match.componentPath]);
            setParams(match.params);
            // setar titulo

            if(match.metadata) {
                if (match.metadata?.title != null) {
                    window.document.title = match.metadata?.title;
                }
            }
        } else {
            // Se não encontrou rota, define como null para mostrar 404
            setCurrentPageComponent(null);
            setParams({});
        }
    }, [router.pathname, findRouteForPath, componentMap]);

    // Ouve os eventos de "voltar" e "avançar" do navegador
    useEffect(() => {
        const handlePopState = () => {
            updateRoute();
        };

        window.addEventListener('popstate', handlePopState);

        // Também se inscreve no router para mudanças de rota
        const unsubscribe = router.subscribe(updateRoute);

        return () => {
            window.removeEventListener('popstate', handlePopState);
            unsubscribe();
        };
    }, [updateRoute]);

    // Resolve o conteúdo principal (página normal ou 404) sem dar return antecipado,
    // para garantir que o ErrorModal apareça em qualquer estado.
    let resolvedContent: React.ReactNode;

    if (!CurrentPageComponent || initialComponentPath === '__404__') {
        const NotFoundComponent = (window as any).__VATTS_NOT_FOUND__;

        if (NotFoundComponent) {
            const NotFoundContent = <NotFoundComponent />;
            resolvedContent = layoutComponent
                ? React.createElement(layoutComponent, { children: NotFoundContent })
                : NotFoundContent;
        } else {
            const DefaultNotFound = (window as any).__VATTS_DEFAULT_NOT_FOUND__;
            const NotFoundContent = <DefaultNotFound />;
            resolvedContent = layoutComponent
                ? React.createElement(layoutComponent, { children: NotFoundContent })
                : NotFoundContent;
        }
    } else {
        const PageContent = <CurrentPageComponent key={`page-${hmrTimestamp}`} params={params} />;
        resolvedContent = layoutComponent
            ? React.createElement(layoutComponent, { children: PageContent })
            : <div>{PageContent}</div>;
    }

    return (
        <>
            {resolvedContent}
            {process.env.NODE_ENV !== 'production' && (
                <DevIndicator
                    hasBuildError={!!buildError}
                    onClickBuildError={() => setIsErrorOpen(true)}
                />
            )}
            <ErrorModal
                error={buildError}
                isOpen={isErrorOpen}
                onClose={() => setIsErrorOpen(false)}
                onCopy={copyBuildError}
            />
        </>
    );
}



// --- Inicialização do Cliente (CSR - Client-Side Rendering) ---

function deobfuscateData(obfuscated: string): any {
    try {
        // Remove o hash fake
        const parts = obfuscated.split('.');
        const base64 = parts.length > 1 ? parts[1] : parts[0];

        // Decodifica base64
        const jsonStr = atob(base64);

        // Parse JSON
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error('[Watts] Failed to decode data:', error);
        return null;
    }
}

// Armazena a referência global do root para poder desmontar no Hot Reload
declare global {
    interface Window {
        __VATTS_ROOT__?: Root;
    }
}

function initializeClient() {
    try {
        // Lê os dados do atributo data-h
        const dataElement = document.getElementById('__vatts_data__');

        if (!dataElement) {
            console.error('[Watts] Initial data script not found (#__vatts_data__).');
            return;
        }

        const obfuscated = dataElement.getAttribute('data-h');

        if (!obfuscated) {
            console.error('[Watts] Data attribute not found.');
            return;
        }

        const initialData = deobfuscateData(obfuscated);

        if (!initialData) {
            console.error('[Vatts] Failed to parse initial data.');
            return;
        }

        // Cria o mapa de componentes dinamicamente a partir dos módulos carregados
        const componentMap: Record<string, any> = {};

        // Registra todos os componentes que foram importados
        if ((window as any).__VATTS_COMPONENTS__) {
            Object.assign(componentMap, (window as any).__VATTS_COMPONENTS__);
        } else {
            console.warn('[Vatts] No components found in window.__VATTS_COMPONENTS__');
        }

        const container = document.getElementById('root');
        if (!container) {
            console.error('[Vatts] Container #root not found.');
            return;
        }

        // --- CORREÇÃO DO HOT RELOAD ---
        // Verifica se já existe um root montado (acontece durante o reload do main.js)
        if (window.__VATTS_ROOT__) {
            // console.log('[Vatts] HMR: Unmounting previous root...');
            try {
                // Desmonta o app anterior para limpar event listeners e nós do DOM
                // Isso evita o erro "NotFoundError: Failed to execute 'removeChild'"
                window.__VATTS_ROOT__.unmount();

                // Limpa o container explicitamente para garantir que o framer-motion/animações
                // não deixaram lixo para trás que confunda o novo React
                container.innerHTML = '';
            } catch (e) {
                console.warn('[Vatts] Warning during unmount:', e);
            }
        }

        // Usar createRoot para render inicial (CSR)
        const root = createRoot(container);

        // Salva a referência globalmente
        window.__VATTS_ROOT__ = root;

        root.render(
            <App
                componentMap={componentMap}
                routes={initialData.routes}
                initialComponentPath={initialData.initialComponentPath}
                initialParams={initialData.initialParams}
                layoutComponent={(window as any).__VATTS_LAYOUT__}
            />
        );

    } catch (error: any) {
        console.error('[Watts] Critical Error rendering application:', error);
        // Exibe erro na tela caso algo crítico falhe
        if (typeof document !== 'undefined') {
            document.body.innerHTML = `
                <div style="font-family: monospace; padding: 20px; color: #ff4444; background: #1a1a1a; min-height: 100vh;">
                    <h1>Vatts Client Error</h1>
                    <p>A critical error occurred while initializing the application.</p>
                    <pre style="background: #000; padding: 15px; border-radius: 5px; overflow: auto;">${error?.message || error}</pre>
                    <pre style="color: #666; font-size: 12px; margin-top: 10px;">${error?.stack || ''}</pre>
                </div>
            `;
        }
    }
}

// Executa quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeClient);
} else {
    // ESM Hoisting Fix:
    // Como este arquivo é importado pelo arquivo gerado automaticamente, ele executa
    // ANTES do corpo do arquivo gerado (onde window.__VATTS_COMPONENTS__ é definido).
    // Usamos setTimeout para garantir que a inicialização ocorra após as atribuições globais.
    setTimeout(initializeClient, 0);
}