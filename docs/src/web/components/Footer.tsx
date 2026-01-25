import {VattsImage} from "vatts/react";
import {FaGithub} from "react-icons/fa6";
import React from "react";

export default function Footer({ version }: any) {
    return (
        <footer className="relative z-10 py-12 px-6 bg-[#0a0a0c]">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                    {/* Brand & Status */}
                    <div className="flex flex-col items-center md:items-start gap-3">
                        <div className="flex items-center gap-3">
                            <VattsImage src="/logo-all-white.png" alt="Vatts" height={"28px"} className="h-7 brightness-125 opacity-80" />
                            <span className="hidden md:block w-px h-4 bg-white/10" />
                            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/5 border border-emerald-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-500/80">v{version}</span>
                            </div>
                        </div>
                        <p className="text-slate-500 text-sm max-w-xs text-center md:text-left">
                            The next-generation framework for building lightning-fast web applications.
                        </p>
                    </div>

                    {/* Social & Legal */}
                    <div className="flex flex-col items-center md:items-end gap-4">
                        <div className="flex items-center gap-6">
                            <a
                                href="https://github.com/mfrazlab/vatts.js"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-slate-400 hover:text-white transition-all transform hover:scale-110"
                            >
                                <FaGithub size={22} />
                            </a>
                        </div>

                        <div className="text-slate-600 text-[12px] tracking-tight font-medium">
                            © {new Date().getFullYear()} <span className="text-slate-400">Vatts.js</span>. Crafted by developers, for developers.
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    )
}