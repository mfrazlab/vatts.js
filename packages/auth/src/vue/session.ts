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
import {
    provide,
    inject,
    ref,
    onMounted,
    onUnmounted,
    type InjectionKey,
    type Ref
} from 'vue';
import type { Session, SessionContextType, SignInOptions, SignInResult, User } from '../types';
import { router } from "vatts/vue";

// Chave de injeção para o TypeScript
export const SessionKey: InjectionKey<SessionContextType> = Symbol('SessionKey');

export interface SessionProviderProps {
    basePath: string;
    refetchInterval: number;
    refetchOnWindowFocus: boolean;
}

/**
 * Composable que contém toda a lógica do SessionProvider.
 * Deve ser chamado dentro do setup do componente.
 */
export function useSessionProviderLogic(props: SessionProviderProps) {
    // Estado reativo
    const session = ref<Session | null>(null);
    const status = ref<'loading' | 'authenticated' | 'unauthenticated'>('loading');

    // Fetch da sessão atual
    const fetchSession = async (): Promise<Session | null> => {
        try {
            const response = await fetch(`${props.basePath}/session`, {
                credentials: 'include'
            });

            if (!response.ok) {
                status.value = 'unauthenticated';
                session.value = null;
                return null;
            }

            const data = await response.json();
            const sessionData = data.session;

            if (sessionData) {
                session.value = sessionData;
                status.value = 'authenticated';
                return sessionData;
            } else {
                session.value = null;
                status.value = 'unauthenticated';
                return null;
            }
        } catch (error) {
            console.error('[vatts-auth] Error fetching session:', error);
            session.value = null;
            status.value = 'unauthenticated';
            return null;
        }
    };

    // SignIn function
    const signIn = async (
        provider: string = 'credentials',
        options: SignInOptions = {}
    ): Promise<SignInResult | undefined> => {
        try {
            const { redirect = true, callbackUrl, ...credentials } = options;

            const response = await fetch(`${props.basePath}/signin`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    provider,
                    ...credentials
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                await fetchSession();

                if (data.type === 'oauth' && data.redirectUrl) {
                    if (redirect && typeof window !== 'undefined') {
                        window.location.href = data.redirectUrl;
                    }
                    return { ok: true, status: 200, url: data.redirectUrl };
                }

                if (data.type === 'session') {
                    const finalUrl = callbackUrl || '/';
                    if (redirect && typeof window !== 'undefined') {
                        try {
                            if (router && typeof router.push === 'function') {
                                router.push(finalUrl);
                            } else {
                                window.location.href = finalUrl;
                            }
                        } catch (e) {
                            window.location.href = finalUrl;
                        }
                    }
                    return { ok: true, status: 200, url: finalUrl };
                }
            } else {
                return {
                    error: data.error || 'Authentication failed',
                    status: response.status,
                    ok: false
                };
            }
        } catch (error) {
            console.error('[vatts-auth] Error on signIn:', error);
            return { error: 'Network error', status: 500, ok: false };
        }
    };

    // SignOut function
    const signOut = async (options: { callbackUrl?: string } = {}): Promise<void> => {
        try {
            await fetch(`${props.basePath}/signout`, {
                method: 'POST',
                credentials: 'include'
            });

            session.value = null;
            status.value = 'unauthenticated';

            if (typeof window !== 'undefined') {
                const url = options.callbackUrl || '/';
                try {
                    if (router && typeof router.push === 'function') {
                        router.push(url);
                    } else {
                        window.location.href = url;
                    }
                } catch (e) {
                    window.location.href = url;
                }
            }
        } catch (error) {
            console.error('[vatts-auth] Error on signOut:', error);
        }
    };

    const update = async (): Promise<Session | null> => {
        return await fetchSession();
    };

    // Ciclo de vida e Listeners
    onMounted(() => {
        fetchSession();

        // Refetch Interval
        let intervalId: ReturnType<typeof setInterval> | null = null;
        if (props.refetchInterval > 0) {
            intervalId = setInterval(() => {
                if (status.value === 'authenticated') {
                    fetchSession();
                }
            }, props.refetchInterval * 1000);
        }

        // Refetch on Focus
        const handleFocus = () => {
            if (props.refetchOnWindowFocus && status.value === 'authenticated') {
                fetchSession();
            }
        };

        if (props.refetchOnWindowFocus) {
            window.addEventListener('focus', handleFocus);
        }

        onUnmounted(() => {
            if (intervalId) clearInterval(intervalId);
            window.removeEventListener('focus', handleFocus);
        });
    });

    // Fornece o contexto para os filhos
    provide(SessionKey, {
        data: session as unknown as Session | null,
        status: status as unknown as any,
        signIn,
        signOut,
        update
    });

    return { session, status };
}

/**
 * Hook para acessar a sessão atual
 */
export function useSession(): SessionContextType {
    const context = inject(SessionKey);
    if (!context) {
        throw new Error('useSession must be used inside a SessionProvider');
    }
    return context;
}

/**
 * Hook para verificar autenticação
 */
export function useAuth(): { user: User | null; isAuthenticated: boolean; isLoading: boolean } {
    const context = useSession();

    // Tratando Refs injetadas
    const sessionData = (context.data as unknown as Ref<Session | null>).value;
    const statusVal = (context.status as unknown as Ref<string>).value;

    return {
        user: sessionData?.user || null,
        isAuthenticated: statusVal === 'authenticated',
        isLoading: statusVal === 'loading'
    };
}