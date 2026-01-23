import React, { useState } from "react";
import { useSession } from "@vatts/auth/react";
import { router } from "vatts/react";
import { Shield, Lock, User, ArrowRight } from "lucide-react";

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { signIn } = useSession();
    const [error, setError] = useState(null);
    const [isLoadingProvider, setIsLoadingProvider] = useState(null);

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const result = await signIn('credentials', {
                redirect: false,
                username: username,
                password: password,
                callbackUrl: '/'
            });

            if (!result || result.error) {
                setError('Invalid credentials. Please check your username and password.');
                setIsLoading(false);
                return;
            }
            router.push("/");

        } catch (err) {
            setError('An unexpected error occurred. Please try again.');
            setIsLoading(false);
        }
    };

    // Cores do tema
    const primaryColor = "#ff6b35";
    const primaryRgb = "255, 107, 53";

    return (
        <div className="min-h-screen bg-[#0d0d0d] text-slate-200 selection:bg-[#ff6b35]/30 font-sans antialiased flex items-center justify-center p-6">
            <style>
                {`
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=JetBrains+Mono:wght@400;500&display=swap');
                    
                    body {
                        background-color: #0d0d0d;
                        font-family: 'Inter', sans-serif;
                    }

                    .vatts-login-card {
                        background: rgba(10, 10, 12, 0.95);
                        border: 1px solid rgba(255, 107, 53, 0.15);
                        box-shadow: 0 50px 100px -20px rgba(0, 0, 0, 1);
                    }

                    .neon-line {
                        height: 1px;
                        width: 100%;
                        background: linear-gradient(90deg, transparent, #e85d04, #ff6b35, transparent);
                        box-shadow: 0 0 15px rgba(255, 107, 53, 0.6);
                    }

                    .input-field {
                        background: rgba(255, 255, 255, 0.03);
                        border: 1px solid rgba(255, 255, 255, 0.05);
                        transition: all 0.2s ease;
                    }

                    .input-field:focus {
                        border-color: rgba(255, 107, 53, 0.4);
                        background: rgba(255, 255, 255, 0.06);
                        box-shadow: 0 0 0 2px rgba(255, 107, 53, 0.1);
                    }

                    .btn-login {
                        background: #ff6b35;
                        color: #0d0d0d;
                        transition: all 0.2s ease;
                    }

                    .btn-login:hover:not(:disabled) {
                        background: #ff8559;
                        box-shadow: 0 0 30px rgba(255, 107, 53, 0.4);
                        transform: translateY(-1px);
                    }
                `}
            </style>

            {/* Ambient Background Elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#ff6b35]/5 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#e85d04]/5 blur-[120px] rounded-full" />
            </div>

            <main className="relative z-10 w-full max-w-[1100px] vatts-login-card backdrop-blur-2xl rounded-[2.5rem] overflow-hidden">
                {/* Linha Neon no topo */}
                <div className="neon-line" />

                <div className="grid grid-cols-1 lg:grid-cols-12">
                    {/* Painel Lateral (Info) */}
                    <div className="hidden lg:flex lg:col-span-5 p-12 flex-col justify-between bg-gradient-to-br from-black/40 to-transparent border-r border-white/5">
                        <div className="space-y-6">
                            <div className="flex items-center gap-4">
                                <img src="https://raw.githubusercontent.com/mfrazlab/vatts.js/master/docs/public/logo-v.png" alt="Vatts" className="w-10 h-10 object-contain" />
                                <h2 className="text-2xl font-black tracking-tighter text-white">Vatts<span style={{ color: primaryColor }}>.js</span></h2>
                            </div>
                            <h3 className="text-4xl font-bold text-white leading-tight">
                                Build faster, <br />
                                <span style={{ color: primaryColor }}>deploy deeper.</span>
                            </h3>
                            <p className="text-slate-400 leading-relaxed font-medium">
                                Access the dashboard to manage your high-performance instances and real-time diagnostics.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-sm text-slate-500 font-mono">
                                <Shield size={16} style={{ color: primaryColor }} />
                                End-to-end encrypted session
                            </div>
                            <div className="h-[1px] w-full" style={{ background: `linear-gradient(90deg, ${primaryColor}40, transparent)` }} />
                        </div>
                    </div>

                    {/* Painel de Login */}
                    <div className="lg:col-span-7 p-8 sm:p-16 flex flex-col justify-center">
                        <div className="mb-10 lg:hidden flex flex-col items-center">
                            <img src="https://raw.githubusercontent.com/mfrazlab/vatts.js/master/docs/public/logo-v.png" alt="Vatts" className="w-16 h-16 mb-4" />
                            <h1 className="text-2xl font-bold text-white">Vatts<span style={{ color: primaryColor }}>.js</span></h1>
                        </div>

                        <div className="max-w-md mx-auto w-full">
                            {/* Social Login Buttons */}
                            <div className="mb-8 flex flex-col gap-3">
                                <button
                                    type="button"
                                    onClick={async () => {
                                        setIsLoadingProvider('google');
                                        setError(null);
                                        try {
                                            const result = await signIn('google', { redirect: true });
                                            if (!result || result.error) {
                                                setError('Google login failed.');
                                            }
                                        } catch {
                                            setError('An unexpected error occurred with Google login.');
                                        } finally {
                                            setIsLoadingProvider(null);
                                        }
                                    }}
                                    disabled={isLoadingProvider !== null}
                                    className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition font-bold text-white text-base active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoadingProvider === 'google' ? (
                                        <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                    ) : (
                                        <span className="inline-flex items-center gap-2">
                                            <span className="inline-block align-middle">
                                                {/* Google SVG */}
                                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <g clipPath="url(#clip0_993_156)">
                                                        <path d="M19.805 10.2306C19.805 9.55056 19.7482 8.86723 19.6264 8.19824H10.2V12.0492H15.6264C15.4014 13.2852 14.6696 14.3666 13.6273 15.0586V17.3171H16.605C18.3482 15.7256 19.805 13.2306 19.805 10.2306Z" fill="#4285F4"/>
                                                        <path d="M10.2 20.0006C12.7 20.0006 14.805 19.1839 16.605 17.3171L13.6273 15.0586C12.6273 15.7586 11.4273 16.1671 10.2 16.1671C7.78999 16.1671 5.72666 14.4666 4.96499 12.2834H1.88499V14.6084C3.69499 17.8839 6.94999 20.0006 10.2 20.0006Z" fill="#34A853"/>
                                                        <path d="M4.96499 12.2834C4.76499 11.6834 4.64999 11.0506 4.64999 10.4006C4.64999 9.75056 4.76499 9.11723 4.96499 8.51723V6.19189H1.88499C1.28832 7.41723 1 8.78389 1 10.4006C1 12.0172 1.28832 13.3839 1.88499 14.6084L4.96499 12.2834Z" fill="#FBBC05"/>
                                                        <path d="M10.2 4.63389C11.5273 4.63389 12.7273 5.09189 13.6696 5.99189L16.6727 3.05856C14.805 1.34189 12.7 0.400558 10.2 0.400558C6.94999 0.400558 3.69499 2.51723 1.88499 5.79189L4.96499 8.11723C5.72666 5.93389 7.78999 4.63389 10.2 4.63389Z" fill="#EA4335"/>
                                                    </g>
                                                    <defs>
                                                        <clipPath id="clip0_993_156">
                                                            <rect width="20" height="20" fill="white"/>
                                                        </clipPath>
                                                    </defs>
                                                </svg>
                                            </span>
                                            <span>Sign in with Google</span>
                                        </span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        setIsLoadingProvider('discord');
                                        setError(null);
                                        try {
                                            const result = await signIn('discord', { redirect: true });
                                            if (!result || result.error) {
                                                setError('Discord login failed.');
                                            }
                                        } catch {
                                            setError('An unexpected error occurred with Discord login.');
                                        } finally {
                                            setIsLoadingProvider(null);
                                        }
                                    }}
                                    disabled={isLoadingProvider !== null}
                                    className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition font-bold text-white text-base active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoadingProvider === 'discord' ? (
                                        <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                    ) : (
                                        <span className="inline-flex items-center gap-2">
                                            <span className="inline-block align-middle">
                                                {/* Discord Lucide Icon */}
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 6.5a16.88 16.88 0 0 0-11 0"/><path d="M6.5 17.5c3.5 1 7.5 1 11 0"/><path d="M4 4c-2.5 4-2.5 12 0 16"/><path d="M20 4c2.5 4 2.5 12 0 16"/><path d="M8.5 15c.5.5 2.5.5 3 0"/><path d="M9 9h.01"/><path d="M15 9h.01"/></svg>
                                            </span>
                                            <span>Sign in with Discord</span>
                                        </span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        setIsLoadingProvider('github');
                                        setError(null);
                                        try {
                                            const result = await signIn('github', { redirect: true });
                                            if (!result || result.error) {
                                                setError('GitHub login failed.');
                                            }
                                        } catch {
                                            setError('An unexpected error occurred with GitHub login.');
                                        } finally {
                                            setIsLoadingProvider(null);
                                        }
                                    }}
                                    disabled={isLoadingProvider !== null}
                                    className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition font-bold text-white text-base active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoadingProvider === 'github' ? (
                                        <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                    ) : (
                                        <span className="inline-flex items-center gap-2">
                                            <span className="inline-block align-middle">
                                                {/* GitHub SVG */}
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.184 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.868-.014-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.004.07 1.532 1.032 1.532 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.339-2.221-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.025A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.295 2.748-1.025 2.748-1.025.546 1.378.202 2.397.1 2.65.64.7 1.028 1.595 1.028 2.688 0 3.847-2.337 4.695-4.566 4.944.359.309.678.919.678 1.852 0 1.336-.012 2.417-.012 2.747 0 .268.18.58.688.482C19.138 20.2 22 16.448 22 12.021 22 6.484 17.523 2 12 2Z"/>
                                                </svg>
                                            </span>
                                            <span>Sign in with GitHub</span>
                                        </span>
                                    )}
                                </button>
                            </div>
                            <div className="flex items-center gap-2 mb-8">
                                <div className="flex-1 h-[1px] bg-white/10" />
                                <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">or</span>
                                <div className="flex-1 h-[1px] bg-white/10" />
                            </div>

                            {error && (
                                <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center animate-in fade-in slide-in-from-top-2 duration-300 font-bold">
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleLogin} className="space-y-6">
                                <div className="space-y-2 group">
                                    <label className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold ml-1">Username</label>
                                    <div className="relative">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#ff6b35] transition-colors" size={18} />
                                        <input
                                            type="text"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            className="w-full pl-12 pr-4 py-4 input-field rounded-2xl text-white placeholder-slate-600 focus:outline-none"
                                            placeholder="Enter your username"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2 group">
                                    <div className="flex justify-between items-center px-1">
                                        <label className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">Password</label>
                                        <a href="#" className="text-[10px] uppercase tracking-[0.1em] font-bold transition-colors" style={{ color: primaryColor }}>Forgot?</a>
                                    </div>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#ff6b35] transition-colors" size={18} />
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full pl-12 pr-4 py-4 input-field rounded-2xl text-white placeholder-slate-600 focus:outline-none"
                                            placeholder="••••••••"
                                            required
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-4 rounded-2xl btn-login font-black text-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                                >
                                    <div className="flex items-center justify-center gap-3">
                                        {isLoading ? (
                                            <div className="w-6 h-6 border-4 border-black/20 border-t-black rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <span>Sign In</span>
                                                <ArrowRight size={20} />
                                            </>
                                        )}
                                    </div>
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}