import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Search,
    Home,
    Download,
    FileText,
    Code,
    GitBranch,
    Wrench,
    BookOpen,
    Settings,
    Palette,
    Globe,
    Zap,
    Box,
    FileCode,
    Book,
    ChevronLeft,
    ChevronRight,
    GithubIcon,
    Shield,
    Lock
} from 'lucide-react';
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

import introductionMd from '../docs/gettingstarted/getting-started.md';
import installationMd from '../docs/gettingstarted/installation.md';
import projectStructureMd from '../docs/gettingstarted/project-structure.md';
import routingMd from '../docs/gettingstarted/routing.md';
import layoutMd from '../docs/gettingstarted/layout.md';
import rpcMd from '../docs/gettingstarted/rpc.md';
import middlewaresMd from '../docs/gettingstarted/middleware.md';

import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { useParallax } from '../hooks/useParallax';
import SearchModal from './SearchModal';
import type { SearchDoc } from '../lib/searchIndex';

// Configurações de Cores Reutilizáveis
const primaryColor = "#ff6b35";
const primaryRgb = "255, 107, 53";

export const sidebarConfig = {
    sections: [
        {
            id: 'vatts',
            title: "Vatts.js",
            items: [
                { id: "introduction", icon: "Home", label: "Introduction", file: introductionMd },
                { id: "installation", icon: "Download", label: "Installation", file: installationMd },
                { id: "project-structure", icon: "Box", label: "Project Structure", file: projectStructureMd },
                { id: "layout", icon: "Palette", label: "Layout System", file: layoutMd },
                { id: "routing", icon: "GitBranch", label: "Routing", file: routingMd },
                { id: "rpc", icon: "Globe", label: "RPC System", file: rpcMd },
                { id: "middlewares", icon: "Wrench", label: "Middlewares", file: middlewaresMd },
            ]
        },
        {
            id: 'auth',
            title: "Vatts Auth",
            items: [
                { id: 'introduction-auth', icon: 'Shield', label: 'Overview', file: gettingStartAuthMd },
                { id: 'installation-auth', icon: 'Download', label: 'Setup Auth', file: installationAuthMd },
                { id: "providers", icon: "Zap", label: "Providers", file: providersAuthMd },
                { id: "sessions", icon: "FileCode", label: "Sessions", file: sessionsAuthMd},
                { id: 'protecting-routes', icon: 'Lock', label: 'Protecting Routes', file: protectingRoutesAuthMd },
                { id: 'custom-providers', icon: 'Code', label: 'Custom Providers', file: customProvidersAuthMd },
            ]
        }
    ]
};

const iconMap: { [key: string]: any } = {
    Home, Download, FileText, Code, GitBranch, Wrench, BookOpen, Settings, Palette, Globe, Zap, Box, FileCode, Book, Shield, Lock
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
        <div class="code-block my-8 group relative">
            <div class="code-header flex justify-between items-center px-4 py-2 bg-white/5 rounded-t-xl border-b border-white/5">
                <span class="text-[10px] uppercase tracking-widest font-bold" style="color: ${primaryColor}cc">${lang || 'code'}</span>
                <button class="copy-button p-1 hover:text-white transition-colors" style="color: ${primaryColor}aa" onclick="navigator.clipboard.writeText(this.getAttribute('data-code'))" data-code="${text.replace(/"/g, '&quot;')}">
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
        <div className="relative h-screen overflow-hidden bg-[#0d0d0d] text-slate-300 selection:bg-[#ff6b35]/30 isolate">
            <style>
                {`
                    .markdown-content h1, .markdown-content h2, .markdown-content h3 { color: #fff; font-weight: 800; }
                    .markdown-content a { color: ${primaryColor}; text-decoration: none; font-weight: 600; }
                    .markdown-content a:hover { text-decoration: underline; }
                    .markdown-content strong { color: #fff; }
                    .markdown-content code:not(pre code) { 
                        background: rgba(${primaryRgb}, 0.1); 
                        color: ${primaryColor}; 
                        padding: 0.2rem 0.4rem; 
                        border-radius: 0.4rem; 
                        font-size: 0.85em;
                    }
                    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 107, 53, 0.1); border-radius: 10px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 107, 53, 0.3); }
                `}
            </style>

            {/* Background Orbs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
                <div ref={orbARef} className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-[#ff6b35]/5 blur-[120px] rounded-full" />
                <div ref={orbBRef} className="absolute top-[20%] -right-[10%] w-[30%] h-[30%] bg-[#e85d04]/5 blur-[100px] rounded-full" />
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
                    <Link href="/" className="p-8 flex items-center gap-4 justify-center">
                        <img src="/logo-all.png" alt="Vatts" className="h-12 rounded-lg object-contain" />
                    </Link>

                    <nav className="flex-1 px-4 py-2 overflow-y-auto custom-scrollbar">
                        {sidebarConfig.sections.map((section, idx) => (
                            <div key={idx} className="mb-8">
                                <h3 className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">
                                    {section.title}
                                </h3>
                                <div className="space-y-1">
                                    {section.items.map((item) => {
                                        const Icon = iconMap[item.icon] || FileText;
                                        const isActive = activeSection === item.id;
                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => navigateToPage(item.id)}
                                                className={`w-full cursor-pointer flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 group ${
                                                    isActive
                                                        ? 'bg-[#ff6b35]/10 text-[#ff6b35] ring-1 ring-[#ff6b35]/20 shadow-[0_0_20px_-5px_rgba(255,107,53,0.2)]'
                                                        : 'hover:bg-white/[0.03] text-slate-400 hover:text-white'
                                                }`}
                                            >
                                                <Icon size={18} className={isActive ? 'text-[#ff6b35]' : 'group-hover:text-[#ff6b35] transition-colors'} />
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
                                className="flex items-center gap-3 w-full max-w-2xl bg-white/[0.03] ring-1 ring-white/10 rounded-full px-4 py-2.5 text-sm text-slate-400 hover:text-white hover:bg-white/[0.05] transition-all"
                            >
                                <Search size={18} className="text-slate-500" />
                                <span className="flex-1 text-left">Search documentation...</span>
                                <span className="flex gap-1 text-[10px] text-slate-500">
                                    <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">⌘</kbd>
                                    <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">K</kbd>
                                </span>
                            </button>

                            <div className="flex items-center gap-6 text-slate-400">
                                <a href="https://github.com/mfrazlab/vatts.js" className="hover:text-[#ff6b35] transition-colors"><GithubIcon size={20} /></a>
                                <div className="h-4 w-px bg-white/10" />
                            </div>
                        </header>

                        {/* Scrollable Content */}
                        <div className="scroll-content-container relative z-10 flex-1 min-h-0 overflow-y-auto overflow-x-auto custom-scrollbar">
                            <div className="max-w-[1000px] mx-auto px-8 py-16 min-w-0">
                                <article className="markdown-content prose prose-invert prose-orange max-w-none">
                                    <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
                                </article>

                                {/* Navigation Footer */}
                                <footer className="mt-24 pt-12 border-t border-white/[0.05] grid grid-cols-2 gap-8">
                                    {getNavigationPages(activeSection).previous ? (
                                        <button
                                            onClick={() => navigateToPage(getNavigationPages(activeSection).previous!.id)}
                                            className="p-6 rounded-2xl bg-white/[0.01] border border-white/[0.05] hover:border-[#ff6b35]/30 transition-all text-left group"
                                        >
                                            <span className="text-xs text-slate-500 flex items-center gap-2 mb-2"><ChevronLeft size={14} /> Previous</span>
                                            <div className="text-white font-bold group-hover:text-[#ff6b35] transition-colors">{getNavigationPages(activeSection).previous!.label}</div>
                                        </button>
                                    ) : <div />}

                                    {getNavigationPages(activeSection).next ? (
                                        <button
                                            onClick={() => navigateToPage(getNavigationPages(activeSection).next!.id)}
                                            className="p-6 rounded-2xl bg-white/[0.01] border border-white/[0.05] hover:border-[#ff6b35]/30 transition-all text-right group"
                                        >
                                            <span className="text-xs text-slate-500 flex items-center justify-end gap-2 mb-2">Next <ChevronRight size={14} /></span>
                                            <div className="text-white font-bold group-hover:text-[#ff6b35] transition-colors">{getNavigationPages(activeSection).next!.label}</div>
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
                                <h4 className="text-[10px] font-bold text-white uppercase tracking-widest mb-6 border-l-2 pl-4" style={{ borderColor: primaryColor }}>On this page</h4>
                                <div className="space-y-4">
                                    {headings.map((h, i) => (
                                        <a
                                            key={i}
                                            href={`#${h.id}`}
                                            className={`block text-sm transition-colors hover:text-[#ff6b35] ${h.level > 1 ? 'ml-4 text-slate-500' : 'text-slate-400 font-medium'}`}
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