import React, { useState } from "react";
import { useSession } from "@vatts/auth/react";
import { importServer, Link } from "vatts/react";
import { Terminal, Cpu, Wifi, Activity, User, LogOut, ShieldCheck } from "lucide-react";

const api = importServer<typeof import("../../backend/helper")>("../../backend/helper");
const { getServerDiagnostics, getPackageVersion } = api;

export default function App() {
    const { data: session, status, signOut } = useSession();
    const [serverData, setServerData] = useState<any>(null);
    const [isLoadingServer, setIsLoadingServer] = useState(false);
    const [terminalLines, setTerminalLines] = useState<string[]>([]);
    const [version, setVersion] = useState<string>();

    useState(async () => {
        setVersion(await getPackageVersion())
    })

    const handleTestConnection = async () => {
        setIsLoadingServer(true);
        setTerminalLines(["> Initializing handshake...", "> Fetching diagnostics..."]);

        try {
            await new Promise(r => setTimeout(r, 800));
            const data = await getServerDiagnostics("Test");
            setServerData(data);
            setTerminalLines(prev => [...prev, "> System online. Data synced."]);
        } catch (error) {
            setTerminalLines(prev => [...prev, "> Connection failed."]);
        } finally {
            setIsLoadingServer(false);
        }
    };

    // Variáveis de estilo para facilitar a manutenção
    const primaryColor = "#ff6b35";
    const primaryRgb = "255, 107, 53";

    return (
        <div className="min-h-screen bg-[#0d0d0d] text-slate-200 selection:bg-[#ff6b35]/30 font-sans antialiased overflow-x-hidden">
            <style>
                {`
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=JetBrains+Mono:wght@400;500&display=swap');
                    
                    body {
                        overflow-x: hidden;
                        background-color: #0d0d0d;
                        font-family: 'Inter', sans-serif;
                    }

                    .neon-line-header {
                        height: 1px;
                        width: 100%;
                        background: linear-gradient(90deg, transparent, #e85d04, #ff6b35, transparent);
                        box-shadow: 0 0 15px rgba(255, 107, 53, 0.4);
                    }

                    .vatts-card {
                        background: rgba(10, 10, 12, 0.95);
                        border: 1px solid rgba(255, 107, 53, 0.1);
                        box-shadow: 0 40px 80px -20px rgba(0, 0, 0, 0.8);
                        transition: all 0.3s ease;
                    }

                    .vatts-card:hover {
                        border-color: rgba(255, 107, 53, 0.25);
                    }

                    .btn-primary {
                        background: rgba(255, 107, 53, 0.1);
                        color: #ff6b35;
                        border: 1px solid rgba(255, 107, 53, 0.2);
                        transition: all 0.2s ease;
                    }

                    .btn-primary:hover:not(:disabled) {
                        background: rgba(255, 107, 53, 0.15);
                        box-shadow: 0 0 20px rgba(255, 107, 53, 0.25);
                    }
                `}
            </style>

            {/* Background Glows (Laranja/Vermelho) */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[10%] -left-[5%] w-[50%] h-[50%] bg-[#ff6b35]/5 blur-[120px] rounded-full" />
                <div className="absolute top-[20%] -right-[10%] w-[40%] h-[60%] bg-[#e85d04]/5 blur-[150px] rounded-full" />
            </div>

            <div className="relative z-10 max-w-[1400px] mx-auto px-6 py-12 lg:py-20">

                <header className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-5">
                            <img
                                src="https://i.imgur.com/fz5N4jL.png"
                                alt="Vatts Logo"
                                className="w-16 h-16 object-contain"
                            />
                            <h1 className="text-5xl font-extrabold tracking-tight text-white">
                                Vatts<span style={{ color: primaryColor }}>.js</span>
                            </h1>
                        </div>
                        <p className="text-slate-400 max-w-lg text-lg leading-relaxed font-medium">
                            The future of fullstack development. High-performance diagnostics and
                            secure authentication built directly into the core.
                        </p>
                    </div>

                    <div className="flex gap-6 items-center border-l border-slate-800 pl-8">
                        <div className="text-center">
                            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mb-1">Status</p>
                            <div className="flex items-center gap-2 font-mono text-sm" style={{ color: primaryColor }}>
                                <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: primaryColor, boxShadow: `0 0 8px ${primaryColor}` }} />
                                OPERATIONAL
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mb-1">Engine</p>
                            <p className="text-slate-200 font-mono text-sm">v{version}</p>
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                    {/* Identity Section */}
                    <section className="lg:col-span-4">
                        <div className="vatts-card rounded-[2rem] overflow-hidden">
                            <div className="neon-line-header" />
                            <div className="p-8">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-8 h-1 rounded-full" style={{ backgroundColor: primaryColor }} />
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Identity</h3>
                                </div>

                                {status === 'authenticated' ? (
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-5">
                                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-800 flex items-center justify-center border border-white/5 shadow-inner">
                                                <User style={{ color: primaryColor }} size={32} />
                                            </div>
                                            <div>
                                                <h4 className="text-xl font-bold text-white">{session!!.user?.name}</h4>
                                                <p className="text-slate-500 text-sm font-mono">{session!!.user?.email}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-3 pt-4">
                                            <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex justify-between items-center">
                                                <div>
                                                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Access Level</p>
                                                    <p className="text-sm text-slate-200 flex items-center gap-2">
                                                        <ShieldCheck size={14} style={{ color: primaryColor }}/> Developer
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => signOut()}
                                                    className="p-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors border border-red-500/10"
                                                    title="Exit"
                                                >
                                                    <LogOut size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-6">
                                        <p className="text-slate-400 mb-6 italic">Secure session not detected.</p>
                                        <Link href="/login"
                                              className="block w-full py-4 rounded-2xl font-black transition-all active:scale-[0.98]"
                                              style={{ backgroundColor: primaryColor, color: '#0d0d0d' }}>
                                            Authenticate Now
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* Diagnostics Section */}
                    <section className="lg:col-span-8">
                        <div className="vatts-card rounded-[2rem] overflow-hidden relative">
                            <div className="neon-line-header" />
                            <div className="p-8">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
                                    <div className="flex items-center gap-4">
                                        <div className="w-8 h-1 rounded-full" style={{ backgroundColor: primaryColor }} />
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Live Diagnostics</h3>
                                    </div>

                                    <button
                                        onClick={handleTestConnection}
                                        disabled={isLoadingServer}
                                        className="btn-primary px-8 py-3 rounded-xl font-bold disabled:opacity-50"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Activity size={18} className={isLoadingServer ? "animate-spin" : ""} />
                                            <span>{isLoadingServer ? "Pinging Server..." : "Run System Test"}</span>
                                        </div>
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Terminal Style Box */}
                                    <div className="font-mono text-sm text-slate-500 bg-black/40 p-6 rounded-2xl min-h-[220px] border border-white/5">
                                        {terminalLines.length === 0 ? (
                                            <p className="opacity-30 italic">// Awaiting execution pulse...</p>
                                        ) : (
                                            terminalLines.map((line, i) => (
                                                <p key={i} className="mb-2 last:text-white" style={{ color: i === terminalLines.length - 1 ? primaryColor : '' }}>
                                                    {line}
                                                </p>
                                            ))
                                        )}
                                    </div>

                                    {/* Data Display */}
                                    <div className="flex flex-col justify-center">
                                        {serverData ? (
                                            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-500">
                                                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                                    <span className="text-slate-500 text-xs flex items-center gap-2"><Cpu size={14}/> Node Host</span>
                                                    <span className="text-white font-bold">{serverData.hostname}</span>
                                                </div>
                                                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                                    <span className="text-slate-500 text-xs flex items-center gap-2"><Activity size={14}/> Memory</span>
                                                    <span className="text-white font-bold">{serverData.memoryUsage}</span>
                                                </div>
                                                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                                    <span className="text-slate-500 text-xs flex items-center gap-2"><Wifi size={14}/> OS</span>
                                                    <span className="text-white font-bold">{serverData.platform}</span>
                                                </div>
                                                <p className="text-[10px] mt-4 truncate font-mono" style={{ color: `${primaryColor}80` }}>
                                                    TOKEN: {serverData.secretHash}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="text-center p-8 border-2 border-dashed border-white/5 rounded-2xl">
                                                <p className="text-slate-600 text-sm">No data fetched yet.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

            </div>
        </div>
    );
}