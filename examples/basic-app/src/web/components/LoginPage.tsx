import React, { useState } from "react";
import { useSession } from "@vatts/auth/react";
import { router } from "vatts/react";
import { Shield, Lock, User, ArrowRight } from "lucide-react";

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { signIn } = useSession();
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
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
                                <img src="https://i.imgur.com/fz5N4jL.png" alt="Vatts" className="w-10 h-10 object-contain" />
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
                            <img src="https://i.imgur.com/zUTrtM5.png" alt="Vatts" className="w-16 h-16 mb-4" />
                            <h1 className="text-2xl font-bold text-white">Vatts<span style={{ color: primaryColor }}>.js</span></h1>
                        </div>

                        <div className="max-w-md mx-auto w-full">
                            <div className="mb-10 text-center lg:text-left">
                                <h1 className="text-3xl font-black text-white mb-3 tracking-tight">Welcome Back</h1>
                                <p className="text-slate-400 font-medium">Enter your credentials to access the console.</p>
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