import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    FaBolt, FaShieldHalved, FaGlobe, FaBox, FaWrench, FaGithub,
    FaMagnifyingGlass, FaXmark, FaMicrochip, FaLayerGroup,
    FaArrowRight, FaTerminal, FaPalette, FaWifi, FaShield, FaReact, FaCode
} from 'react-icons/fa6';
import {importServer, Link, VattsImage} from "vatts/react"
import { sidebarConfig } from './docs';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { useParallax } from '../hooks/useParallax';
import SearchModal from './SearchModal';
import type { SearchDoc } from '../lib/searchIndex';

const api = importServer<typeof import("../../backend/helper")>("../../backend/helper");
const { PackageVersion } = api;

const VattsLanding = () => {
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [version, setVersion] = useState("1.0.0")

    useState(async () => {
        const v = await PackageVersion()
        if(v !== null) {
            setVersion(v)
        }
    })

    const reducedMotion = usePrefersReducedMotion();

    const primaryColor = "#a8a8a8";
    const primaryRgb = "82, 82, 82";

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
    const heroTitle = useScrollReveal({ threshold: 0.25, once: false });
    const heroSubtitle = useScrollReveal({ threshold: 0.2, once: false });
    const heroButtons = useScrollReveal({ threshold: 0.2, once: false });
    const heroCmd = useScrollReveal({ threshold: 0.2, once: false });
    const featHeader = useScrollReveal({ threshold: 0.2, once: false });
    const featGrid = useScrollReveal({ threshold: 0.15, once: false });
    const archHeader = useScrollReveal({ threshold: 0.2, once: false });
    const archGrid = useScrollReveal({ threshold: 0.15, once: false });

    return (
        <div className={`min-h-screen bg-black text-slate-300 selection:bg-[#2b2b2a]/30 font-sans selection:text-white relative custom-scrollbar`}>


            <SearchModal
                open={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                docs={docsForSearch}
                placeholder="Search documentation..."
            />

            <nav className="sticky top-0 z-50 w-full border-b border-white/[0.05] bg-[#0d0d0d]/80 backdrop-blur-md">
                <div className="flex h-16 items-center justify-between px-6 max-w-7xl mx-auto">
                    <div className="flex items-center gap-6">
                        <div className="relative group cursor-pointer flex items-center gap-3 mr-3">
                            <VattsImage src="/logo-all-white.png" height={"32px"} alt="Vatts" className="relative rounded-lg" />
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
                            <FaGithub size={20} />
                        </a>
                    </div>
                </div>
            </nav>
            <section className="relative z-10 pt-24 pb-20 px-6 text-left overflow-hidden border-b border-white/5">
                {/* --- GRADE E ELEMENTOS VISUAIS --- */}
                <div className="grid-background" />
                <div className="grid-corner-circle circle-top-left" />
                <div className="grid-corner-circle circle-bottom-right" />

                <style>{`
        .grid-background {
            position: absolute;
            inset: 0;
            z-index: 0;
            background-image: 
                linear-gradient(to right, rgba(255, 255, 255, 0.15) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(255, 255, 255, 0.15) 1px, transparent 1px);
            background-size: 60px 60px;

            /* A MÁGICA AQUI: 
               Usamos uma elipse começando no topo (50% 0%) para que 
               o brilho maior fique no centro-topo e desvaneça para baixo e para os lados.
            */
            mask-image: radial-gradient(ellipse at 50% 0%, black 20%, transparent 80%);
            -webkit-mask-image: radial-gradient(ellipse at 50% 0%, black 20%, transparent 80%);
            
            animation: gridFadeIn 1.2s ease-out forwards;
        }

        .grid-corner-circle {
            position: absolute;
            width: 300px;
            height: 300px;
            border: 1px dashed rgba(255, 255, 255, 0.15);
            border-radius: 50%;
            z-index: 1;
            opacity: 0;
            
            /* Máscara para o próprio círculo não ficar com a borda interna muito "seca" */
            mask-image: radial-gradient(circle at center, black 40%, transparent 100%);
            -webkit-mask-image: radial-gradient(circle at center, black 40%, transparent 100%);
            
            animation: gridFadeIn 1.5s ease-out 0.3s forwards;
        }

        .circle-top-left {
            top: -100px;
            left: -100px;
        }

        .circle-bottom-right {
            bottom: -100px;
            right: -100px;
            /* Se quiser que o círculo de baixo apareça menos que o de cima: */
            opacity: 0.1; 
        }

        @keyframes gridFadeIn {
            from {
                opacity: 0;
                transform: scale(0.95);
            }
            to {
                opacity: 1;
                transform: scale(1);
            }
        }
    `}</style>

                {/* Conteúdo do Hero */}
                <div className="relative z-10 max-w-5xl mx-auto">

                    {/* Badge Industrial */}
                    <div
                        className="vatts-reveal vatts-reveal-fade inline-block px-3 py-1 rounded-full border border-gray-500/20 bg-gray-500/5 text-white text-[10px] font-bold uppercase tracking-[0.2em] mb-8"
                        style={{ ['--d' as any]: '0ms' }}
                    >
                        Framework v{version} {version.includes("alpha") ? "" : 'Stable'}
                    </div>

                    <h1
                        ref={heroTitle.ref as any}
                        {...heroTitle.props}
                        className="vatts-reveal vatts-reveal-up vatts-stagger text-6xl md:text-[100px] font-black text-white tracking-tighter leading-[0.9] mb-8"
                        style={{ ['--d' as any]: '90ms' }}
                    >
                        THE FRAMEWORK <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-600 to-gray-300">FOR WEB.</span>
                    </h1>

                    <p
                        ref={heroSubtitle.ref as any}
                        {...heroSubtitle.props}
                        className="vatts-reveal vatts-reveal-up vatts-stagger max-w-2xl text-lg md:text-xl text-slate-400 leading-relaxed mb-12 font-medium"
                        style={{ ['--d' as any]: '160ms' }}
                    >
                        Vatts.js is a high-performance full-stack primitive. No fluff, just raw speed, type-safety, and the best developer experience for building massive applications.
                    </p>

                    <div
                        ref={heroButtons.ref as any}
                        {...heroButtons.props}
                        className="vatts-reveal vatts-reveal-up vatts-stagger flex flex-col sm:flex-row items-center gap-5"
                        style={{ ['--d' as any]: '230ms' }}
                    >
                        <div className={`p-1 rounded-2xl bg-gradient-to-b from-white/10 to-white/5 hover:to-[${primaryColor}]/20 transition-all duration-500 vatts-tilt vatts-sheen`}>
                            <div ref={heroCmd.ref as any} {...heroCmd.props} className="vatts-reveal vatts-reveal-fade vatts-stagger relative max-w-md" style={{ ['--d' as any]: '230ms' }}>
                                <div className="absolute inset-0 bg-gray-200 blur-2xl rounded-full" />
                                <Link href="/docs" className="text-black relative flex items-center justify-between gap-4 px-6 py-4 bg-gray-200  rounded-xl text-[18px] font-mono shadow-2xl">
                                    Get started
                                </Link>
                            </div>
                        </div>

                        <div className={` p-1 rounded-2xl bg-gradient-to-b from-white/10 to-white/5 hover:to-[${primaryColor}]/20 transition-all duration-500 vatts-tilt vatts-sheen`}>
                            <div ref={heroCmd.ref as any} {...heroCmd.props} className="vatts-reveal vatts-reveal-fade vatts-stagger relative max-w-md" style={{ ['--d' as any]: '230ms' }}>
                                <div className={`absolute inset-0 bg-[${primaryColor}]/20 blur-2xl rounded-full`} />
                                <div className="relative flex items-center justify-between gap-4 px-6 py-4 bg-[#0a0a0c] border border-white/10 rounded-xl text-sm font-mono shadow-2xl">
                                    <span style={{ color: primaryColor }}>$</span>
                                    <span className="text-slate-300 flex-1 text-left">npx create-vatts-app@latest</span>
                                    <FaTerminal size={16} className="text-slate-600" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>


            <div>
                <div className="pointer-events-none fixed inset-0 z-0">
                    <div
                        className="absolute inset-0"
                        style={{
                            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)',
                            backgroundSize: '30px 30px',

                            /* Mask mais suave: não mata tanto em cima/baixo */
                            maskImage: `
              radial-gradient(
                ellipse 100% 80% at 50% 50%,
                rgba(0,0,0,1) 45%,
                rgba(0,0,0,0.6) 70%,
                rgba(0,0,0,0.2) 85%,
                transparent 100%
              )
            `,
                            WebkitMaskImage: `
              radial-gradient(
                ellipse 100% 80% at 50% 50%,
                rgba(0,0,0,1) 45%,
                rgba(0,0,0,0.6) 70%,
                rgba(0,0,0,0.2) 85%,
                transparent 100%
              )
            `,

                            animation: 'fastReveal 1.5s ease-out forwards'
                        }}
                    />
                </div>
                <style>{`
        @keyframes fastReveal {
            0% {
                opacity: 0;
                transform: scale(0.96);
            }
            100% {
                opacity: 0.22; /* mais aparente, mas sem cansar */
                transform: scale(1);
            }
        }
    `}</style>

                {/* Architecture Section */}
                <section className="relative z-10 max-w-6xl mx-auto px-6 py-32">
                    <div ref={archHeader.ref as any} {...archHeader.props} className="vatts-reveal vatts-reveal-up flex flex-col items-center mb-20">
                        <h2 className="text-4xl font-black text-white text-center">Engineered for Excellence</h2>
                        <div className="w-24 h-1 mt-6 rounded-full" style={{ backgroundColor: primaryColor }} />
                    </div>

                    <div ref={archGrid.ref as any} {...archGrid.props} className="vatts-reveal vatts-reveal-up grid grid-cols-1 md:grid-cols-3 gap-6">

                        {/* Card 1: Rollup */}
                        <div className="group relative p-1 rounded-xl bg-gradient-to-b from-white/10 to-white/5 hover:to-yellow-500/20 transition-all duration-500 vatts-tilt vatts-sheen">
                            <div className="relative h-full bg-[#111111] rounded-[10px] p-8 overflow-hidden border border-white/5 flex flex-col">
                                <div className="flex items-start gap-5 mb-8 relative z-10">
                                    <div className="shrink-0 p-2.5 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                                        <VattsImage src="https://rollupjs.org/rollup-logo.svg" width="28px" height="28px" alt="Rollup"  />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <h3 className="text-xl font-bold text-white">Rollup</h3>
                                            <span className="text-[10px] font-mono text-slate-500">@latest</span>
                                        </div>
                                        <p className="text-sm text-slate-400">Fast builds and maximum production performance.</p>
                                    </div>
                                </div>

                                <div className="mt-auto bg-[#171717] rounded-lg p-4  font-mono text-[11px] text-slate-300">
                                    <div className="flex justify-between text-slate-500 mb-3 pb-2">
                                        <span>builder.ts</span>
                                        <span className="text-yellow-400 text-[10px]">Node API</span>
                                    </div>
                                    <div className="space-y-1.5">

                                        <div className="flex flex-wrap gap-1">
                                            <span className="text-purple-400">import</span>
                                            <span>{'{'}</span>
                                            <span className="text-yellow-300">build</span>
                                            <span>{'}'}</span>
                                            <span className="text-purple-400">from</span>
                                            <span className="text-emerald-400">'rollup'</span>
                                        </div>

                                        <div className="flex flex-wrap gap-1">
                                            <span className="text-purple-400">await</span>
                                            <span className="text-blue-400">build</span>
                                            <span>(</span>
                                            <span>{'{'}</span>
                                        </div>

                                        <div className="pl-4 flex flex-wrap gap-1 text-slate-400">
                                            <span className="text-sky-400">root</span>
                                            <span>:</span>
                                            <span className="text-emerald-400">'./src'</span>
                                            <span>,</span>
                                        </div>

                                        <div className="flex flex-wrap gap-1">
                                            <span>{'}'}</span>
                                            <span>)</span>
                                        </div>

                                    </div>

                                </div>
                            </div>
                        </div>

                        {/* Card 2: React */}
                        <div className="group relative p-1 rounded-xl bg-gradient-to-b from-white/10 to-white/5 hover:to-cyan-500/20 transition-all duration-500 vatts-tilt vatts-sheen">
                            <div className="relative h-full bg-[#111111] rounded-[10px] p-8 overflow-hidden border border-white/5 flex flex-col">
                                <div className="flex items-start gap-5 mb-8 relative z-10">
                                    <div className="shrink-0 p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20 text-cyan-400">
                                        <FaReact size="28"></FaReact>

                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <h3 className="text-xl font-bold text-white">React 19</h3>
                                            <span className="text-[10px] font-mono text-slate-500">Stable</span>
                                        </div>
                                        <p className="text-sm text-slate-400">Instant interactions and seamless Suspense.</p>
                                    </div>
                                </div>

                                <div className="mt-auto bg-[#171717] rounded-lg p-4 font-mono text-[11px] text-slate-300">
                                    <div className="flex justify-between text-slate-500 mb-3 pb-2">
                                        <span>counter.tsx</span>
                                        <span className="text-cyan-400 text-[10px]">Client</span>
                                    </div>
                                    <div className="space-y-1.5">

                                        <div className="flex flex-wrap gap-1">
                                            <span className="text-purple-400">function</span>
                                            <span className="text-blue-400">Counter</span>
                                            <span>()</span>
                                            <span>{'{'}</span>
                                        </div>

                                        <div className="pl-4 flex flex-wrap gap-1">
                                            <span className="text-purple-400">const</span>
                                            <span>[</span>
                                            <span className="text-sky-400">counter</span>
                                            <span>,</span>
                                            <span className="text-blue-400">setCounter</span>
                                            <span>]</span>
                                            <span>=</span>
                                            <span className="text-yellow-300">useState</span>
                                            <span>(</span>
                                            <span className="text-emerald-400">0</span>
                                            <span>)</span>
                                        </div>

                                        <div className="pl-4 flex flex-wrap gap-1">
                                            <span className="text-blue-400">setCounter</span>
                                            <span>(</span>
                                            <span className="text-sky-400">counter</span>
                                            <span className="text-slate-400"> + </span>
                                            <span className="text-emerald-400">1</span>
                                            <span>)</span>
                                        </div>

                                        <div>{'}'}</div>

                                    </div>

                                </div>
                            </div>
                        </div>

                        {/* Card 3: Tailwind */}
                        <div className="group relative p-1 rounded-xl bg-gradient-to-b from-white/10 to-white/5 hover:to-pink-500/20 transition-all duration-500 vatts-tilt vatts-sheen">
                            <div className="relative h-full bg-[#111111] rounded-[10px] p-8 overflow-hidden border border-white/5 flex flex-col">
                                <div className="flex items-start gap-5 mb-8 relative z-10">
                                    <div className="shrink-0 p-2.5 bg-pink-500/10 rounded-lg border border-pink-500/20">
                                        <svg width="28" height="28" viewBox="0 0 32 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path className="fill-pink-500" d="M17.183 0C12.6 0 9.737 2.291 8.59 6.873c1.719-2.29 3.723-3.15 6.014-2.577 1.307.326 2.242 1.274 3.275 2.324 1.685 1.71 3.635 3.689 7.894 3.689 4.582 0 7.445-2.291 8.591-6.872-1.718 2.29-3.723 3.15-6.013 2.576-1.308-.326-2.243-1.274-3.276-2.324C23.39 1.98 21.44 0 17.183 0ZM8.59 10.309C4.01 10.309 1.145 12.6 0 17.182c1.718-2.291 3.723-3.15 6.013-2.577 1.308.326 2.243 1.274 3.276 2.324 1.685 1.71 3.635 3.689 7.894 3.689 4.582 0 7.445-2.29 8.59-6.872-1.718 2.29-3.722 3.15-6.013 2.577-1.307-.327-2.242-1.276-3.276-2.325-1.684-1.71-3.634-3.689-7.893-3.689Z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <h3 className="text-xl font-bold text-white">Tailwind CSS</h3>
                                            <span className="text-[10px] font-mono text-slate-500">v4.0</span>
                                        </div>
                                        <p className="text-sm text-slate-400">Modern utility-first design system built-in.</p>
                                    </div>
                                </div>

                                <div className="mt-auto bg-[#171717] rounded-lg p-4 font-mono text-[11px] text-slate-300">
                                    <div className="flex justify-between text-slate-500 mb-3  pb-2">
                                        <span>styles.css</span>
                                        <span className="text-pink-400 text-[10px]">Zero Runtime</span>
                                    </div>
                                    <div className="space-y-1.5">

                                        <div className="flex flex-wrap gap-1">
                                            <span className="text-purple-400">@theme</span>
                                            <span>{'{'}</span>
                                        </div>

                                        <div className="pl-4 flex flex-wrap gap-1 text-slate-400">
                                            <span className="text-sky-400">--color-primary</span>
                                            <span>:</span>
                                            <span className="text-pink-400">#ec4899</span>
                                            <span>;</span>
                                        </div>

                                        <div className="pl-4 flex flex-wrap gap-1 text-slate-400">
                                            <span className="text-sky-400">--font-sans</span>
                                            <span>:</span>
                                            <span className="text-emerald-400">'Inter'</span>
                                            <span>;</span>
                                        </div>

                                        <div>{'}'}</div>

                                    </div>

                                </div>
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

                    <div ref={featGrid.ref as any} {...featGrid.props} className="vatts-reveal vatts-reveal-up grid grid-cols-1 md:grid-cols-3 gap-5 z-1000">

                        <div className={`md:col-span-2 group relative p-1 rounded-xl bg-gradient-to-b from-white/10 to-white/5 hover:to-[${primaryColor}]/20 transition-all duration-500 vatts-tilt vatts-sheen`}>
                            <div className="relative h-full bg-[#111111] rounded-[10px] p-8 overflow-hidden border border-white/5 flex flex-col justify-between">

                                {/* Layout Horizontal: Ícone + Texto */}
                                <div className="flex items-start gap-6 mb-8 relative z-10">
                                    <div className="shrink-0">
                                        <div className="p-3 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                            <FaGlobe size={28} />
                                        </div>
                                    </div>

                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-3">
                                            <h3 className="text-2xl font-bold text-white">Native RPC System</h3>
                                            <div className="text-[10px] font-bold text-cyan-500/80 uppercase tracking-widest border border-cyan-500/20 px-2 py-1 rounded bg-cyan-950/30">Core</div>
                                        </div>
                                        <p className="text-slate-400 max-w-md">Direct server-to-client communication. Expose your backend logic specifically to your frontend with zero boilerplate.</p>
                                    </div>
                                </div>

                                {/* Bloco de Código */}
                                <div className="mt-auto relative z-10 rounded-xl bg-[#171717] p-4 font-mono text-[11px] leading-relaxed text-slate-300 shadow-2xl backdrop-blur transition-all duration-300 group-hover:border-blue-500/30">
                                    <div className="mb-3 flex items-center justify-between pb-2 text-slate-500">
                                        <span className="text-xs">src/backend/actions.ts</span>
                                        <span className="text-xs font-medium text-cyan-400">Server Side</span>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex flex-wrap gap-1">
                                            <span className="text-purple-400">import</span>
                                            <span>{'{'}</span>
                                            <span className="text-yellow-300">Expose</span>
                                            <span>{'}'}</span>
                                            <span className="text-purple-400">from</span>
                                            <span className="text-emerald-400">"vatts/rpc"</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            <span className="text-purple-400">import</span>
                                            <span>{'{'}</span>
                                            <span className="text-yellow-300">platform</span>
                                            <span>{'}'}</span>
                                            <span className="text-purple-400">from</span>
                                            <span className="text-emerald-400">"node:os"</span>
                                        </div>
                                        <div className="h-2" />
                                        <div className="flex flex-wrap gap-1">
                                            <span className="text-purple-400">export function</span>
                                            <div className="gap-0">
                                                <span className="text-blue-400">getPlatform</span>
                                                <span>(</span>
                                                <span>)</span>
                                            </div>
                                            <span>{'{'}</span>
                                        </div>
                                        <div className="pl-4 text-slate-400">
                                            <span className="text-purple-400">return</span>
                                            <span className="ml-1">platform()</span>
                                        </div>
                                        <div>{'}'}</div>
                                        <div className="h-1" />
                                        <div className="flex gap-0">
                                            <span className="text-yellow-300">Expose</span>
                                            <span>(</span>
                                            <span className="text-blue-400">getUser</span>
                                            <span>)</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={`group relative p-1 rounded-xl bg-gradient-to-b from-white/10 to-white/5 hover:to-[${primaryColor}]/20 transition-all duration-500 vatts-tilt vatts-sheen`}>
                            <div className="relative h-full bg-[#111111] rounded-[10px] p-8 overflow-hidden border border-white/5 transition-all duration-500 flex flex-col">

                                {/* Layout Horizontal: Ícone + Texto */}
                                <div className="flex items-start gap-6 mb-8 relative z-10">
                                    <div className="shrink-0">
                                        <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                            <FaShield size={28} />
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-white mb-3">Vatts Auth</h3>
                                        <p className="text-slate-400">Secure session management built-in. Protect your routes and data effortlessly.</p>
                                    </div>
                                </div>

                                {/* Bloco de Código */}
                                <div className="mt-auto relative z-10 rounded-xl bg-[#171717] p-4 font-mono text-[11px] leading-relaxed text-slate-300 shadow-2xl backdrop-blur transition-all duration-300 group-hover:border-blue-500/30">
                                    <div className="mb-3 flex items-center justify-between text-slate-500">
                                        <span className="text-xs">profile.tsx</span>
                                        <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex flex-wrap gap-1">
                                            <span className="text-purple-400">import</span>
                                            <span>{'{'}</span>
                                            <span className="text-yellow-300">useSession</span>
                                            <span>{'}'}</span>
                                            <span className="text-purple-400">from</span>
                                            <span className="text-emerald-400">"@vatts/auth"</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            <span className="text-purple-400">const</span>
                                            <span>{'{'}</span>
                                            <span className="text-sky-400">user</span>
                                            <span>{'}'}</span>
                                            <span>=</span>
                                            <div className="gap-0">
                                                <span className="text-blue-400">useSession</span>
                                                <span>()</span>
                                            </div>
                                        </div>
                                        <div className="pt-1 text-slate-500">
                                            <span className="text-emerald-400">//</span> Auto-protected context
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {[
                            {
                                icon: FaLayerGroup,
                                title: "Pattern Routing",
                                desc: "Flexible route matching with regex support. Not just file-system based.",
                                color: "text-purple-400",
                                bg: "bg-purple-500/10",
                                border: "hover:border-purple-500/30"
                            },
                            {
                                icon: FaBolt,
                                title: "Powered by Rollup",
                                desc: "Designed for fast builds and maximum production performance.",
                                color: "text-orange-400",
                                bg: "bg-orange-500/10",
                                border: "hover:border-orange-500/30"
                            },
                            {
                                icon: FaWifi,
                                title: "Native WebSockets",
                                desc: "Real-time ready. Upgrade any route to a persistent connection.",
                                color: "text-emerald-400",
                                bg: "bg-emerald-500/10",
                                border: "hover:border-emerald-500/30"
                            }
                        ].map((item, idx) => (
                            <div key={idx} className={`group relative p-1 rounded-xl bg-gradient-to-b from-white/10 to-white/5 hover:to-[${primaryColor}]/20 transition-all duration-500 vatts-tilt vatts-sheen ${item.border}`} style={{ transitionDelay: `${idx * 50}ms` }}>
                                <div className="relative h-full bg-[#111111] rounded-[10px] p-6 overflow-hidden border border-white/5 flex items-start gap-4">
                                    {/* Lado Esquerdo: Ícone */}
                                    <div className={`p-2.5 rounded-lg ${item.bg} ${item.color} shrink-0`}>
                                        <item.icon size={24} />
                                    </div>

                                    {/* Lado Direito: Título e Descrição */}
                                    <div>
                                        <h4 className="text-lg font-bold text-white mb-2">{item.title}</h4>
                                        <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

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
        </div>
    );
};

export default VattsLanding;