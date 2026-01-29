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
import { createApp, type App as VueApp } from 'vue';
import App from './App.vue';

// --- Inicialização do Cliente (CSR - Client-Side Rendering) ---

function deobfuscateData(obfuscated: string): any {
    try {
        const parts = obfuscated.split('.');
        const base64 = parts.length > 1 ? parts[1] : parts[0];
        const jsonStr = atob(base64);
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error('[Vatts] Failed to decode data:', error);
        return null;
    }
}

// Armazena a referência global da app Vue para HMR
declare global {
    interface Window {
        __VATTS_APP__?: VueApp;
    }
}

function initializeClient() {
    try {
        const dataElement = document.getElementById('__vatts_data__');

        if (!dataElement) {
            console.error('[Vatts] Initial data script not found (#__vatts_data__).');
            return;
        }

        const obfuscated = dataElement.getAttribute('data-h');

        if (!obfuscated) {
            console.error('[Vatts] Data attribute not found.');
            return;
        }

        const initialData = deobfuscateData(obfuscated);

        if (!initialData) {
            console.error('[Vatts] Failed to parse initial data.');
            return;
        }

        const componentMap: Record<string, any> = {};

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

        // --- CORREÇÃO DO HOT RELOAD (Vue Version) ---
        if (window.__VATTS_APP__) {
            try {
                // Desmonta a instância anterior do Vue
                window.__VATTS_APP__.unmount();
                container.innerHTML = '';
            } catch (e) {
                console.warn('[Vatts] Warning during unmount:', e);
            }
        }
        console.log((window as any).__VATTS_COMPONENTS__, initialData)

        // Cria a instância do Vue
        const app = createApp(App, {
            componentMap,
            routes: initialData.routes,
            initialComponentPath: initialData.initialComponentPath,
            initialParams: initialData.initialParams,
            layoutComponent: (window as any).__VATTS_LAYOUT__
        });


        // Salva a referência globalmente
        window.__VATTS_APP__ = app;

        // Monta no elemento #root
        app.mount(container);

    } catch (error: any) {
        console.error('[Vatts] Critical Error rendering application:', error);
        if (typeof document !== 'undefined') {
            document.body.innerHTML = `
                <div style="font-family: monospace; padding: 20px; color: #ff4444; background: #1a1a1a; min-height: 100vh;">
                    <h1>Vatts Client Error (Vue)</h1>
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
    setTimeout(initializeClient, 0);
}