import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Zap,
    Shield,
    Globe,
    Box,
    Wrench,
    Github,
    Search,
    X,
    Cpu,
    Layout,
    ArrowRight,
    Terminal, Palette, Wifi
} from 'lucide-react';
import { Link } from "vatts/react"
import { sidebarConfig } from './docs';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { useParallax } from '../hooks/useParallax';
import SearchModal from './SearchModal';
import type { SearchDoc } from '../lib/searchIndex';

const VattsLanding = () => {
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const reducedMotion = usePrefersReducedMotion();

    const primaryColor = "#ff6b35";
    const primaryRgb = "255, 107, 53";

    const particles = useMemo(
        () =>
            Array.from({ length: 60 }).map((_, i) => ({
                id: i,
                left: Math.random() * 100,
                top: Math.random() * 100,
                duration: 3 + Math.random() * 5,
                delay: i * 0.07,
                size: Math.random() < 0.12 ? 2 : 1,
                opacity: 0.15 + Math.random() * 0.45,
            })),
        []
    );

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsSearchOpen(true);
            }
            if (e.key === 'Escape') setIsSearchOpen(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const docsForSearch: SearchDoc[] = useMemo(() => {
        return sidebarConfig.sections.flatMap((section) =>
            section.items.map((item) => ({
                id: item.id,
                label: item.label,
                category: section.title,
                href: `/docs/${section.id}/${item.id}`,
                content: typeof (item as any).file === 'string' ? (item as any).file : '',
            }))
        );
    }, []);

    const GridBackground = () => {
        const orbARef = useRef<HTMLDivElement | null>(null);
        const orbBRef = useRef<HTMLDivElement | null>(null);

        useParallax(orbARef, !reducedMotion, { intensity: 42, axis: 'y', invert: true });
        useParallax(orbBRef, !reducedMotion, { intensity: 34, axis: 'y', invert: false });

        return (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute inset-0" style={{
                    backgroundImage: `
                    linear-gradient(to right, rgba(${primaryRgb}, 0.03) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(${primaryRgb}, 0.03) 1px, transparent 1px)
                `,
                    backgroundSize: '80px 80px',
                    maskImage: 'radial-gradient(circle at center, black, transparent 80%)'
                }} />

                {/* Orbs Quentes */}
                <div ref={orbARef} className="absolute top-1/4 left-1/4 w-[680px] h-[680px] bg-gradient-to-r from-[#ff6b35]/10 via-[#e85d04]/5 to-transparent blur-[140px] rounded-full animate-pulse" />
                <div ref={orbBRef} className="absolute bottom-1/4 right-1/4 w-[560px] h-[560px] bg-gradient-to-l from-[#ff4d00]/10 via-[#ff9500]/5 to-transparent blur-[130px] rounded-full animate-pulse delay-1000" />

                <div className="absolute inset-0">
                    {particles.map((p) => (
                        <div
                            key={p.id}
                            className="absolute rounded-full vatts-particle"
                            style={{
                                left: `${p.left}%`,
                                top: `${p.top}%`,
                                width: `${p.size}px`,
                                height: `${p.size}px`,
                                opacity: p.opacity,
                                backgroundColor: primaryColor,
                                animationDuration: `${p.duration}s`,
                                animationDelay: `${p.delay}s`,
                                filter: `drop-shadow(0 0 10px rgba(${primaryRgb}, 0.25))`
                            }}
                        />
                    ))}
                </div>

                <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#ff6b35]/10 to-transparent" />
                <div className="absolute left-1/2 top-0 h-full w-px bg-gradient-to-b from-transparent via-[#ff6b35]/10 to-transparent" />
            </div>
        );
    };

    const heroTitle = useScrollReveal({ threshold: 0.25, once: false });
    const heroSubtitle = useScrollReveal({ threshold: 0.2, once: false });
    const heroButtons = useScrollReveal({ threshold: 0.2, once: false });
    const heroCmd = useScrollReveal({ threshold: 0.2, once: false });
    const featHeader = useScrollReveal({ threshold: 0.2, once: false });
    const featGrid = useScrollReveal({ threshold: 0.15, once: false });
    const archHeader = useScrollReveal({ threshold: 0.2, once: false });
    const archGrid = useScrollReveal({ threshold: 0.15, once: false });

    return (
        <div className="min-h-screen bg-[#0d0d0d] text-slate-300 selection:bg-[#ff6b35]/30 font-sans selection:text-white relative custom-scrollbar overflow-x-hidden">
            <GridBackground/>

            <SearchModal
                open={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                docs={docsForSearch}
                placeholder="Search documentation..."
            />

            <nav className="sticky top-0 z-50 w-full border-b border-white/[0.05] bg-[#0d0d0d]/80 backdrop-blur-md">
                <div className="flex h-16 items-center justify-between px-6 max-w-7xl mx-auto">
                    <div className="flex items-center gap-6">
                        <div className="relative group cursor-pointer flex items-center gap-3">
                            <img src="/logo-v.png" alt="Vatts" className="relative h-11 rounded-lg" />
                        </div>
                        <Link href="/docs" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Docs</Link>
                        <a href="https://npmjs.com/vatts" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Npm</a>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsSearchOpen(true)}
                            className="hidden md:flex items-center gap-3 bg-white/[0.05] border border-white/10 rounded-md px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:border-[#ff6b35]/30 transition-all w-64 group"
                        >
                            <span className="flex-1 text-left">Search docs...</span>
                            <div className="flex gap-1 text-[10px] opacity-50">
                                <kbd className="bg-black/20 border border-white/10 px-1.5 rounded">Ctrl</kbd>
                                <kbd className="bg-black/20 border border-white/10 px-1.5 rounded">K</kbd>
                            </div>
                        </button>
                        <a href="https://github.com/mfrazlab/vatts.js" className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full" target="_blank" rel="noreferrer">
                            <Github size={20} />
                        </a>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative z-10 pt-12 pb-32 px-6 text-center overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-[#ff6b35]/5 blur-[120px] rounded-full" />
                </div>

                <h1
                    ref={heroTitle.ref as any}
                    {...heroTitle.props}
                    className="vatts-reveal vatts-reveal-up vatts-stagger text-5xl md:text-8xl font-black text-white tracking-tight mb-4 leading-[1.05]"
                    style={{ ['--d' as any]: '90ms' }}
                >
                    The next-generation <br />
                    <span style={{ color: primaryColor }}>framework</span> for the web
                </h1>

                <p
                    ref={heroSubtitle.ref as any}
                    {...heroSubtitle.props}
                    className="vatts-reveal vatts-reveal-up vatts-stagger max-w-3xl mx-auto text-xl md:text-2xl text-slate-400 mb-4 leading-relaxed"
                    style={{ ['--d' as any]: '160ms' }}
                >
                    Built for developers who value speed and type-safety. Vatts.js lets you create
                    <span className="text-white font-semibold"> high-quality web applications</span> with seamless backend integration.
                </p>

                <div ref={heroButtons.ref as any} {...heroButtons.props} className="vatts-reveal vatts-reveal-up vatts-stagger flex flex-col md:flex-row items-center justify-center gap-5 mb-10" style={{ ['--d' as any]: '230ms' }}>
                    <Link href="/docs/vatts/installation"
                          className="vatts-tilt vatts-sheen w-full md:w-auto px-10 py-4 rounded-xl font-black text-lg transition-all hover:-translate-y-1 shadow-[0_20px_40px_-10px_rgba(255,107,53,0.3)]"
                          style={{ backgroundColor: primaryColor, color: '#0d0d0d' }}>
                        Get Started
                    </Link>
                    <Link href="/docs" className="vatts-tilt vatts-sheen w-full md:w-auto px-10 py-4 bg-white/[0.03] text-white border border-white/10 rounded-xl font-bold hover:bg-white/5 transition-all hover:-translate-y-1 backdrop-blur-sm">
                        Read the Docs
                    </Link>
                </div>

                {/* Command Box */}
                <div className="w-fit mx-auto p-1 rounded-2xl bg-gradient-to-b from-white/10 to-white/5 hover:to-[#ff6b35]/20 transition-all duration-500 vatts-tilt vatts-sheen">
                    <div ref={heroCmd.ref as any} {...heroCmd.props} className="vatts-reveal vatts-reveal-fade vatts-stagger relative max-w-md" style={{ ['--d' as any]: '230ms' }}>
                        <div className="absolute inset-0 bg-[#ff6b35]/20 blur-2xl rounded-full" />
                        <div className="relative flex items-center justify-between gap-4 px-6 py-4 bg-[#0a0a0c] border border-white/10 rounded-xl text-sm font-mono shadow-2xl">
                            <span style={{ color: primaryColor }}>$</span>
                            <span className="text-slate-300 flex-1 text-left">npx @vatts/create-app@latest</span>
                            <Terminal size={16} className="text-slate-600" />
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="relative z-10 max-w-7xl mx-auto px-6 py-24">
                <div ref={featHeader.ref as any} {...featHeader.props} className="vatts-reveal vatts-reveal-up mb-16">
                    <h2 className="text-3xl font-bold text-white mb-4 text-center">What's in Vatts.js?</h2>
                    <p className="text-slate-400 text-center max-w-2xl mx-auto">Everything you need to build great products on the web, packed into a cohesive framework.</p>
                </div>

                <div ref={featGrid.ref as any} {...featGrid.props} className="vatts-reveal vatts-reveal-up grid grid-cols-1 md:grid-cols-3 gap-5">

                    <div className="md:col-span-2 group relative p-1 rounded-xl bg-gradient-to-b from-white/10 to-white/5 hover:to-orange-500/20 transition-all duration-500 vatts-tilt vatts-sheen">
                        <div className="relative h-full bg-[#0a0a0c] rounded-[10px] p-8 overflow-hidden border border-white/5 flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start mb-6 relative z-10">
                                    <div className="p-3 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                        <Globe size={28} />
                                    </div>
                                    <div className="text-[10px] font-bold text-cyan-500/80 uppercase tracking-widest border border-cyan-500/20 px-2 py-1 rounded bg-cyan-950/30">Core</div>
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-3 relative z-10">Native RPC System</h3>
                                <p className="text-slate-400 relative z-10 max-w-md mb-8">Direct server-to-client communication. Expose your backend logic specifically to your frontend with zero boilerplate.</p>
                            </div>


                            <div className="relative z-10 bg-[#151517] rounded-lg border border-white/10 p-4 font-mono text-xs text-slate-300 shadow-2xl group-hover:border-cyan-500/30 transition-colors">
                                <div className="flex justify-between text-slate-500 mb-3 pb-2 border-b border-white/5">
                                    <span>server/actions.ts</span>
                                    <span className="text-cyan-400">Server Side</span>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex gap-2"><span className="text-purple-400">import</span> {'{'} Expose {'}'} <span className="text-purple-400">from</span> <span className="text-green-400">"vatts/rpc"</span></div>
                                    <div className="h-2"></div>
                                    <div className="flex gap-2"><span className="text-purple-400">export function</span> <span className="text-blue-400">getUser</span>(id) {'{'}</div>
                                    <div className="pl-4 text-slate-400"><span className="text-purple-400">return</span> db.users.find(id)</div>
                                    <div className="flex gap-2">{'}'}</div>
                                    <div className="h-1"></div>
                                    <div className="flex "><span className="text-yellow-400">Expose</span>(getUser)</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="group relative p-1 rounded-xl bg-gradient-to-b from-white/10 to-white/5 hover:to-orange-500/20 transition-all duration-500 vatts-tilt vatts-sheen">
                        <div className="relative h-full bg-[#0a0a0c] rounded-[10px] p-8 overflow-hidden border border-white/5 transition-all duration-500 flex flex-col">
                            <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400 w-fit mb-6 border border-blue-500/20">
                                <Shield size={28} />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-3">Vatts Auth</h3>
                            <p className="text-slate-400 mb-6">Secure session management built-in. Protect your routes and data effortlessly.</p>

                            <div className="mt-auto relative z-10 bg-[#151517] rounded-lg border border-white/10 p-4 font-mono text-xs text-slate-300 shadow-xl group-hover:border-blue-500/30 transition-colors">
                                <div className="flex justify-between text-slate-500 mb-2">
                                    <span>profile.tsx</span>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex flex-wrap gap-1 mb-2">
                                        <span className="text-purple-400">import</span>
                                        {'{'} <span className="text-yellow-300">useSession</span> {'}'}
                                        <span className="text-purple-400">from</span>
                                        <span className="text-green-400">"@vatts/auth"</span>
                                    </div>
                                    <div className="flex gap-2"><span className="text-purple-400">const</span> {'{'} user {'}'} = <span className="text-blue-400">useSession</span>()</div>
                                    <div className="text-slate-500 mt-1">// Auto-protected context</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {[
                        {
                            icon: Layout,
                            title: "Pattern Routing",
                            desc: "Flexible route matching with regex support. Not just file-system based.",
                            color: "text-purple-400",
                            bg: "bg-purple-500/10",
                            border: "hover:border-purple-500/30"
                        },
                        {
                            icon: Zap,
                            title: "Powered by Rollup",
                            desc: "Designed for fast builds and maximum production performance.",
                            color: "text-orange-400",
                            bg: "bg-orange-500/10",
                            border: "hover:border-orange-500/30"
                        },
                        {
                            icon: Wifi,
                            title: "Native WebSockets",
                            desc: "Real-time ready. Upgrade any route to a persistent connection.",
                            color: "text-emerald-400",
                            bg: "bg-emerald-500/10",
                            border: "hover:border-emerald-500/30"
                        }
                    ].map((item, idx) => (
                        <div key={idx} className={`group relative p-1 rounded-xl bg-gradient-to-b from-white/10 to-white/5 hover:to-orange-500/20 transition-all duration-500 vatts-tilt vatts-sheen ${item.border}`} style={{ transitionDelay: `${idx * 50}ms` }}>
                            <div className="relative h-full bg-[#0a0a0c] rounded-[10px] p-6 overflow-hidden border border-white/5">
                                <div className={`p-2.5 rounded-lg ${item.bg} ${item.color} w-fit mb-4`}>
                                    <item.icon size={24} />
                                </div>
                                <h4 className="text-lg font-bold text-white mb-2">{item.title}</h4>
                                <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Architecture Section */}
            <section className="relative z-10 max-w-6xl mx-auto px-6 py-32">
                <div ref={archHeader.ref as any} {...archHeader.props} className="vatts-reveal vatts-reveal-up flex flex-col items-center mb-20">
                    <h2 className="text-4xl font-black text-white text-center">Engineered for Excellence</h2>
                    <div className="w-24 h-1 mt-6 rounded-full" style={{ backgroundColor: primaryColor }} />
                </div>

                <div ref={archGrid.ref as any} {...archGrid.props} className="vatts-reveal vatts-reveal-up grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="group relative p-1 rounded-xl bg-gradient-to-b from-white/10 to-white/5 hover:to-yellow-500/20 transition-all duration-500 vatts-tilt vatts-sheen" >
                        <div className="relative h-full bg-[#0a0a0c] rounded-[10px] p-8 overflow-hidden border border-white/5">
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="p-3 bg-yellow-500/10 rounded-lg text-yellow-400">
                                        <Zap size={24} />
                                    </div>
                                    <span className="text-xs font-mono text-slate-500">@latest</span>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">Powered by Rollup</h3>
                                <p className="text-sm text-slate-400 mb-6">Designed for fast builds and maximum production performance</p>

                                <div className="bg-[#151517] rounded-lg p-3 border border-white/5 font-mono text-xs text-slate-300">
                                    <div className="flex justify-between text-slate-500 mb-2">
                                        <span>builder.ts</span>
                                        <span className="text-yellow-400">Node API</span>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex gap-2"><span className="text-purple-400">import</span> {'{'} build {'}'} <span className="text-purple-400">from</span> <span className="text-green-400">'rollup'</span></div>
                                        <div className="flex gap-2"><span className="text-purple-400">await</span> build({'{'}</div>
                                        <div className="pl-4 text-slate-400">root: <span className="text-green-400">'./src'</span>,</div>
                                        <div className="flex gap-2">{'}'})</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="group relative p-1 rounded-xl bg-gradient-to-b from-white/10 to-white/5 hover:to-cyan-500/20 transition-all duration-500 vatts-tilt vatts-sheen" >
                        <div className="relative h-full bg-[#0a0a0c] rounded-[10px] p-8 overflow-hidden border border-white/5">
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="p-3 bg-cyan-500/10 rounded-lg text-cyan-400">
                                        <Box size={24} />
                                    </div>
                                    <span className="text-xs font-mono text-slate-500">React 19</span>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">React Client Components</h3>
                                <p className="text-sm text-slate-400 mb-6">Built for the future of React. Instant interactions, client-side rendering, and seamless Suspense.</p>

                                <div className="bg-[#151517] rounded-lg p-3 border border-white/5 font-mono text-xs text-slate-300">
                                    <div className="flex justify-between text-slate-500 mb-2">
                                        <span>counter.tsx</span>
                                        <span className="text-cyan-400">Client</span>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex gap-2"><span className="text-blue-400">function</span> Counter() {'{'}</div>
                                        <div className="pl-4 flex gap-2"><span className="text-purple-400">const</span> [v, set] = useState(0)</div>
                                        <div className="flex gap-2">{'}'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="group relative p-1 rounded-xl bg-gradient-to-b from-white/10 to-white/5 hover:to-pink-500/20 transition-all duration-500 vatts-tilt vatts-sheen" >
                        <div className="relative h-full bg-[#0a0a0c] rounded-[10px] p-8 overflow-hidden border border-white/5">
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="p-3 bg-pink-500/10 rounded-lg text-pink-400">
                                        <Palette size={24} />
                                    </div>
                                    <span className="text-xs font-mono text-slate-500">v4.0</span>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">Tailwind CSS</h3>
                                <p className="text-sm text-slate-400 mb-6">Utility-first framework for rapid UI development. Modern design system built-in.</p>

                                <div className="bg-[#151517] rounded-lg p-3 border border-white/5 font-mono text-xs text-slate-300">
                                    <div className="flex justify-between text-slate-500 mb-2">
                                        <span>styles.css</span>
                                        <span className="text-pink-400">Zero Runtime</span>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex gap-2"><span className="text-purple-400">@theme</span> {'{'}</div>
                                        <div className="pl-4 text-slate-400">--color-primary: <span className="text-pink-400">#ec4899</span>;</div>
                                        <div className="flex gap-2">{'}'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <footer className="relative z-10 py-20 border-t border-white/5 px-6 bg-[#0a0a0c]">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
                    <div className="flex items-center gap-4">
                        <img src="/logo-all.png" alt="Vatts" className="h-8 opacity-50" />
                    </div>
                    <div className="text-slate-500 text-sm font-medium">
                        © {new Date().getFullYear()} Vatts.js. Built for the modern web.
                    </div>
                    <a href="https://github.com/mfrazlab/vatts.js" className="text-slate-400 hover:text-white transition-all flex items-center gap-2">
                        <Github size={24} />
                    </a>
                </div>
            </footer>
        </div>
    );
};

export default VattsLanding;