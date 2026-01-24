// docs.tsx modificado para o tema Cinza/Noir
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { marked } from 'marked';
import Prism from 'prismjs';

// Importar linguagens Prism
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markdown';
import { Link } from "vatts/react"

// Docs Imports
import gettingStartAuthMd from '../docs/auth/getting-started.md';
import installationAuthMd from '../docs/auth/installation.md';
import providersAuthMd from '../docs/auth/providers.md';
import sessionsAuthMd from '../docs/auth/session.md';
import protectingRoutesAuthMd from '../docs/auth/protecting-routes.md';
import customProvidersAuthMd from '../docs/auth/custom-providers.md';

import introductionMd from '../docs/vatts/getting-started.md';
import installationMd from '../docs/vatts/installation.md';
import projectStructureMd from '../docs/vatts/project-structure.md';
import routingMd from '../docs/vatts/routing.md';
import layoutMd from '../docs/vatts/layout.md';
import rpcMd from '../docs/vatts/rpc.md';
import middlewaresMd from '../docs/vatts/middleware.md';

import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { useParallax } from '../hooks/useParallax';
import SearchModal from './SearchModal';
import type { SearchDoc } from '../lib/searchIndex';
import {
    FaBolt, FaBook,
    FaBookOpen, FaBox,
    FaChevronLeft,
    FaChevronRight,
    FaDownload,
    FaFile, FaGear,
    FaGit,
    FaGithub, FaGlobe, FaPalette, FaShield,
    FaWrench,
    FaCode, FaLock, FaCodeCompare,
} from "react-icons/fa6";
import {FaSearch, FaHome} from "react-icons/fa";

// Configurações de Cores Modificadas (Preto e Branco / Cinza)
const primaryColor = "#a8a8a8"; // Cinza da Index
const primaryRgb = "82, 82, 82"; // RGB da Index

export const sidebarConfig = {
    sections: [
        {
            id: 'vatts',
            title: "Vatts.js",
            items: [
                { id: "introduction", icon: "FaHome", label: "Introduction", file: introductionMd },
                { id: "installation", icon: "FaDownload", label: "Installation", file: installationMd },
                { id: "project-structure", icon: "FaBox", label: "Project Structure", file: projectStructureMd },
                { id: "layout", icon: "FaPalette", label: "Layout System", file: layoutMd },
                { id: "routing", icon: "FaCodeCompare", label: "Routing", file: routingMd },
                { id: "rpc", icon: "FaGlobe", label: "RPC System", file: rpcMd },
                { id: "middlewares", icon: "FaWrench", label: "Middlewares", file: middlewaresMd },
            ]
        },
        {
            id: 'auth',
            title: "Vatts Auth",
            items: [
                { id: 'introduction-auth', icon: 'FaShield', label: 'Overview', file: gettingStartAuthMd },
                { id: 'installation-auth', icon: 'FaDownload', label: 'Setup Auth', file: installationAuthMd },
                { id: "providers", icon: "FaBolt", label: "Providers", file: providersAuthMd },
                { id: "sessions", icon: "FaFile", label: "Sessions", file: sessionsAuthMd},
                { id: 'protecting-routes', icon: 'FaLock', label: 'Protecting Routes', file: protectingRoutesAuthMd },
                { id: 'custom-providers', icon: 'FaCode', label: 'Custom Providers', file: customProvidersAuthMd },
            ]
        }
    ]
};

const iconMap: { [key: string]: any } = {
    FaHome, FaDownload, FaFile, FaCode, FaCodeCompare, FaWrench, FaBookOpen, FaGear, FaPalette, FaGlobe, FaBolt, FaBox, FaBook, FaShield, FaLock
};

const generateId = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const renderer = new marked.Renderer();
renderer.heading = ({ text, depth }: any) => {
    const id = generateId(text);
    return `<h${depth} id="${id}" class="group flex items-center gap-2">
                ${text}
                <a href="#${id}" class="opacity-0 group-hover:opacity-100 transition-opacity" style="color: ${primaryColor}">#</a>
            </h${depth}>`;
};

renderer.code = ({ text, lang }: any) => {
    const validLanguage = lang && Prism.languages[lang] ? lang : 'plaintext';
    const highlighted = Prism.highlight(text, Prism.languages[validLanguage], validLanguage);
    return `
        <div class="code-block my-8 group relative rounded-xl border border-white/5 bg-[#0a0a0c]">
            <div class="code-header flex justify-between items-center px-4 py-2 bg-white/[0.03] rounded-t-xl border-b border-white/5">
                <span class="text-[10px] uppercase tracking-widest font-bold text-zinc-500">${lang || 'code'}</span>
                <button class="copy-button p-1 text-zinc-600 hover:text-white transition-colors" onclick="navigator.clipboard.writeText(this.getAttribute('data-code'))" data-code="${text.replace(/"/g, '&quot;')}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                </button>
            </div>
            <pre class="language-${validLanguage} !bg-transparent !m-0 !p-6 overflow-x-auto"><code class="language-${validLanguage}">${highlighted}</code></pre>
        </div>
    `;
};

marked.setOptions({ renderer });

export default function VattsDocs({ params }: any) {
    const pageId = params?.value2 || 'introduction';
    const [activeSection, setActiveSection] = useState(pageId);
    const [htmlContent, setHtmlContent] = useState('');
    const [headings, setHeadings] = useState<any[]>([]);
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    const reducedMotion = usePrefersReducedMotion();
    const orbARef = useRef<HTMLDivElement | null>(null);
    const orbBRef = useRef<HTMLDivElement | null>(null);

    useParallax(orbARef, !reducedMotion, { intensity: 18, invert: true });
    useParallax(orbBRef, !reducedMotion, { intensity: 14, invert: false });

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

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setIsSearchOpen(true);
            }
            if (e.key === 'Escape') setIsSearchOpen(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const getAllPages = () => sidebarConfig.sections.flatMap(section => section.items);

    const getNavigationPages = (currentId: string) => {
        const allPages = getAllPages();
        const currentIndex = allPages.findIndex(page => page.id === currentId);
        return {
            previous: currentIndex > 0 ? allPages[currentIndex - 1] : null,
            next: currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null
        };
    };

    useEffect(() => {
        const currentItem = sidebarConfig.sections.flatMap(s => s.items).find(i => i.id === activeSection);
        if (currentItem?.file) {
            setHtmlContent(marked.parse(currentItem.file) as string);
            const headingRegex = /^(#{1,2})\s+(.+)$/gm;
            const matches = [...currentItem.file.matchAll(headingRegex)];
            setHeadings(matches.map(m => ({ id: generateId(m[2]), text: m[2], level: m[1].length })));
            setTimeout(() => Prism.highlightAll(), 0);
        }
    }, [activeSection]);

    const navigateToPage = (itemId: string) => {
        const section = sidebarConfig.sections.find(s => s.items.some(item => item.id === itemId));
        if (section) {
            const newUrl = `/docs/${section.id}/${itemId}`;
            window.history.pushState({}, '', newUrl);
            setActiveSection(itemId);
            document.querySelector('.scroll-content-container')?.scrollTo(0, 0);
        }
    };

    return (
        <div className="relative h-screen overflow-hidden bg-[#0d0d0d] text-slate-400 selection:bg-white/10 isolate">
            <style>
                {`
                    .markdown-content h1, .markdown-content h2, .markdown-content h3 { color: #fff; font-weight: 800; }
                    .markdown-content a { color: #fff; text-decoration: none; border-bottom: 1px solid rgba(255,255,255,0.2); font-weight: 600; transition: all 0.2s; }
                    .markdown-content a:hover { border-bottom-color: #fff; }
                    .markdown-content strong { color: #fff; }
                    .markdown-content code:not(pre code) { 
                        background: rgba(255, 255, 255, 0.05); 
                        color: #d1d1d1; 
                        padding: 0.2rem 0.4rem; 
                        border-radius: 0.4rem; 
                        font-size: 0.85em;
                        border: 1px solid rgba(255,255,255,0.1);
                    }
                    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.15); }
                `}
            </style>

            {/* Background Orbs (White/Gray Version) */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
                <div ref={orbARef} className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-white/[0.03] blur-[120px] rounded-full" />
                <div ref={orbBRef} className="absolute top-[20%] -right-[10%] w-[30%] h-[30%] bg-zinc-500/[0.03] blur-[100px] rounded-full" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0d0d0d]/30 to-[#0d0d0d]" />
            </div>

            <SearchModal
                open={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                docs={docsForSearch}
                placeholder="Search documentation..."
            />

            <div className="relative z-0 flex h-full min-w-0">
                {/* Sidebar */}
                <aside className="z-20 w-80 min-w-80 max-w-80 h-screen sticky top-0 hidden lg:flex flex-col bg-white/[0.01] backdrop-blur-xl border-r border-white/[0.05] flex-none overflow-hidden">
                    <Link href="/" className="p-8 flex items-center gap-4 justify-center grayscale hover:grayscale-0 transition-all duration-500">
                        <img src="/logo-all-white.png" alt="Vatts" className="h-8 rounded-lg object-contain" />
                    </Link>

                    <nav className="flex-1 px-4 py-2 overflow-y-auto custom-scrollbar">
                        {sidebarConfig.sections.map((section, idx) => (
                            <div key={idx} className="mb-8">
                                <h3 className="px-4 text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-4">
                                    {section.title}
                                </h3>
                                <div className="space-y-1">
                                    {section.items.map((item) => {
                                        const Icon = iconMap[item.icon] || FaFile;
                                        const isActive = activeSection === item.id;
                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => navigateToPage(item.id)}
                                                className={`w-full cursor-pointer flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 group ${
                                                    isActive
                                                        ? 'bg-white/5 text-white ring-1 ring-white/10 shadow-[0_0_20px_-5px_rgba(255,255,255,0.1)]'
                                                        : 'hover:bg-white/[0.03] text-zinc-500 hover:text-zinc-200'
                                                }`}
                                            >
                                                <Icon size={18} className={isActive ? 'text-white' : 'group-hover:text-zinc-300 transition-colors'} />
                                                <span className="text-sm font-medium tracking-wide truncate">{item.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </nav>
                </aside>

                {/* Main Content Area */}
                <main className="relative z-10 flex-1 h-full min-w-0 overflow-hidden">
                    <div className="flex flex-col h-full min-w-0">
                        {/* Floating Header */}
                        <header className="z-30 h-20 flex-none sticky top-0 bg-[#0d0d0d]/80 backdrop-blur-md px-8 flex items-center justify-between border-b border-white/[0.05]">
                            <button
                                type="button"
                                onClick={() => setIsSearchOpen(true)}
                                className="flex items-center gap-3 w-full max-w-2xl bg-white/[0.02] ring-1 ring-white/5 rounded-full px-4 py-2.5 text-sm text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] transition-all"
                            >
                                <FaSearch size={18} className="text-zinc-600" />
                                <span className="flex-1 text-left">Search documentation...</span>
                                <span className="flex gap-1 text-[10px] text-zinc-600">
                                    <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">⌘</kbd>
                                    <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">K</kbd>
                                </span>
                            </button>

                            <div className="flex items-center gap-6 text-zinc-500">
                                <a href="https://github.com/mfrazlab/vatts.js" className="hover:text-white transition-colors"><FaGithub size={20} /></a>
                                <div className="h-4 w-px bg-white/10" />
                            </div>
                        </header>

                        {/* Scrollable Content */}
                        <div className="scroll-content-container relative z-10 flex-1 min-h-0 overflow-y-auto overflow-x-auto custom-scrollbar">
                            <div className="max-w-[1000px] mx-auto px-8 py-16 min-w-0">
                                <article className="markdown-content prose prose-invert max-w-none">
                                    <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
                                </article>

                                {/* Navigation Footer */}
                                <footer className="mt-24 pt-12 border-t border-white/[0.05] grid grid-cols-2 gap-8">
                                    {getNavigationPages(activeSection).previous ? (
                                        <button
                                            onClick={() => navigateToPage(getNavigationPages(activeSection).previous!.id)}
                                            className="p-6 rounded-2xl bg-white/[0.01] border border-white/[0.05] hover:border-white/20 transition-all text-left group"
                                        >
                                            <span className="text-xs text-zinc-600 flex items-center gap-2 mb-2"><FaChevronLeft size={14} /> Previous</span>
                                            <div className="text-zinc-400 font-bold group-hover:text-white transition-colors">{getNavigationPages(activeSection).previous!.label}</div>
                                        </button>
                                    ) : <div />}

                                    {getNavigationPages(activeSection).next ? (
                                        <button
                                            onClick={() => navigateToPage(getNavigationPages(activeSection).next!.id)}
                                            className="p-6 rounded-2xl bg-white/[0.01] border border-white/[0.05] hover:border-white/20 transition-all text-right group"
                                        >
                                            <span className="text-xs text-zinc-600 flex items-center justify-end gap-2 mb-2">Next <FaChevronRight size={14} /></span>
                                            <div className="text-zinc-400 font-bold group-hover:text-white transition-colors">{getNavigationPages(activeSection).next!.label}</div>
                                        </button>
                                    ) : <div />}
                                </footer>
                            </div>
                        </div>
                    </div>
                </main>

                {/* Right TOC */}
                <aside className="z-20 w-72 min-w-72 max-w-72 h-screen sticky top-0 hidden xl:block flex-none overflow-hidden">
                    <div className="h-full p-10 bg-white/[0.01] backdrop-blur-xl border-l border-white/[0.05] overflow-y-auto custom-scrollbar">
                        <div className="space-y-8">
                            <div>
                                <h4 className="text-[10px] font-bold text-zinc-200 uppercase tracking-widest mb-6 border-l-2 pl-4 border-zinc-700">On this page</h4>
                                <div className="space-y-4">
                                    {headings.map((h, i) => (
                                        <a
                                            key={i}
                                            href={`#${h.id}`}
                                            className={`block text-sm transition-colors hover:text-white ${h.level > 1 ? 'ml-4 text-zinc-600' : 'text-zinc-500 font-medium'}`}
                                        >
                                            {h.text}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}