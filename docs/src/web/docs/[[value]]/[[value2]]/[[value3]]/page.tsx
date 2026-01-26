import React, { useState, useEffect, useRef } from 'react';
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
import 'prismjs/themes/prism-okaidia.css';
import 'prismjs/components/prism-markup';
import { usePrefersReducedMotion } from '../../../../hooks/usePrefersReducedMotion';
import { useParallax } from '../../../../hooks/useParallax';
import Navbar from '../../../../components/Navbar';
import Footer from "../../../../components/Footer";

import {
    FaBolt, FaBook,
    FaBookOpen, FaBox,
    FaChevronLeft,
    FaChevronRight,
    FaChevronDown,
    FaDownload,
    FaFile, FaGear,
    FaGit,
    FaGithub, FaGlobe, FaPalette, FaShield,
    FaWrench,
    FaCode, FaLock, FaCodeCompare, FaCube, FaDiagramProject,
    FaReact,
    FaVuejs
} from "react-icons/fa6";
import { FaSearch, FaHome } from "react-icons/fa";
import { sidebarConfig } from "../../../../lib/searchIndex";
import { Metadata, router } from "vatts/react";

const primaryColor = "#a8a8a8";

const iconMap: { [key: string]: any } = {
    FaCube, FaDiagramProject, FaHome, FaDownload, FaFile, FaCode, FaCodeCompare, FaWrench, FaBookOpen, FaGear, FaPalette, FaGlobe, FaBolt, FaBox, FaBook, FaShield, FaLock
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
// Faz com que Prism.languages['vue'] deixe de ser undefined
if (Prism.languages.markup) {
    Prism.languages.vue = Prism.languages.markup;
}
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
    // Lógica para extrair Brand, Framework e PageId da URL
    const brand = params?.value || 'vatts';
    const isFrameworkParam = params?.value2 === 'react' || params?.value2 === 'vue';

    const initialFramework = isFrameworkParam ? params.value2 : 'react';
    const initialPageId = isFrameworkParam ? (params?.value3 || 'introduction') : (params?.value2 || 'introduction');

    const [activeSection, setActiveSection] = useState(initialPageId);
    const [framework, setFramework] = useState<'react' | 'vue'>(initialFramework as 'react' | 'vue');

    const [htmlContent, setHtmlContent] = useState('');
    const [headings, setHeadings] = useState<any[]>([]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const reducedMotion = usePrefersReducedMotion();
    const orbARef = useRef<HTMLDivElement | null>(null);
    const orbBRef = useRef<HTMLDivElement | null>(null);

    useParallax(orbARef, !reducedMotion, { intensity: 18, invert: true });
    useParallax(orbBRef, !reducedMotion, { intensity: 14, invert: false });

    const getAllPages = () => {
        return sidebarConfig.sections.flatMap(section => section.items);
    };

    const getNavigationPages = (currentId: string) => {
        const allPages = getAllPages();
        const currentIndex = allPages.findIndex(page => page.id === currentId);
        return {
            previous: currentIndex > 0 ? allPages[currentIndex - 1] : null,
            next: currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null
        };
    };

    // Sincroniza estado com a URL quando os params mudam
    useEffect(() => {
        if (isFrameworkParam) {
            setFramework(params.value2);
            setActiveSection(params.value3 || 'introduction');
        } else {
            setFramework('react');
            setActiveSection(params.value2 || 'introduction');
        }
    }, [params?.value2, params?.value3]);

    useEffect(() => {
        const currentItem = sidebarConfig.sections
            .flatMap(s => s.items)
            .find(i => i.id === activeSection);

        if (currentItem?.file) {
            const content = typeof currentItem.file === 'string'
                ? currentItem.file
                : (currentItem.file[framework] || currentItem.file['react']);

            setHtmlContent(marked.parse(content) as string);
            const headingRegex = /^(#{1,2})\s+(.+)$/gm;
            const matches = [...content.matchAll(headingRegex)];
            setHeadings(matches.map((m: any) => ({ id: generateId(m[2]), text: m[2], level: m[1].length })));
            setTimeout(() => Prism.highlightAll(), 0);
        }
    }, [activeSection, framework]);

    const navigateToPage = (itemId: string, newFramework?: string) => {
        const targetFramework = newFramework || framework;
        // Estrutura: /docs/[brand]/[framework]/[itemId]
        const newUrl = `/docs/${brand}/${targetFramework}/${itemId}`;
        router.push(newUrl);
    };

    return (
        <div className="relative min-h-screen bg-black text-slate-400 selection:bg-white/10 isolate flex flex-col">
            <Navbar />

            <div className="relative z-0 flex flex-1 min-w-0 bg-black">
                {/* Sidebar Esquerda */}
                <aside className="z-20 w-80 min-w-80 max-w-80 h-[calc(100vh-8rem)] mb-6 ml-6 sticky top-24 self-start hidden lg:flex flex-col rounded-2xl flex-none overflow-hidden shadow-2xl">

                    {/* Framework Selector */}
                    <div className="p-4 border-b border-white/5 relative">
                        <button
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="w-full cursor-pointer flex items-center justify-between p-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 rounded-xl transition-all group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 shadow-inner">
                                    {framework === 'react' ? <FaReact className="text-sky-400" size={18} /> : <FaVuejs className="text-emerald-400" size={18} />}
                                </div>
                                <div className="text-left">
                                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none mb-1">Using Framework</p>
                                    <p className="text-sm font-bold text-white leading-none capitalize">{framework}</p>
                                </div>
                            </div>
                            <FaChevronDown size={12} className={`text-zinc-500 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Dropdown Menu */}
                        {isDropdownOpen && (
                            <div className="absolute top-[calc(100%-8px)] left-4 right-4 z-50 mt-2 p-1 bg-[#0f0f11] border border-white/10 rounded-xl shadow-2xl backdrop-blur-xl">
                                <button
                                    onClick={() => { setIsDropdownOpen(false); navigateToPage(activeSection, 'react'); }}
                                    className={`w-full cursor-pointer flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${framework === 'react' ? 'bg-white/5 text-white' : 'hover:bg-white/[0.03] text-zinc-400'}`}
                                >
                                    <FaReact className="text-sky-400" size={16} />
                                    <span className="text-sm font-medium">React.js</span>
                                </button>
                                <button
                                    onClick={() => { setIsDropdownOpen(false); navigateToPage(activeSection, 'vue'); }}
                                    className={`w-full cursor-pointer flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${framework === 'vue' ? 'bg-white/5 text-white' : 'hover:bg-white/[0.03] text-zinc-400'}`}
                                >
                                    <FaVuejs className="text-emerald-400" size={16} />
                                    <span className="text-sm font-medium">Vue.js</span>
                                </button>
                            </div>
                        )}
                    </div>

                    <nav className="flex-1 px-4 py-6 overflow-y-auto custom-scrollbar">
                        {sidebarConfig.sections.map((section, idx) => {
                            const filteredItems = section.items;
                            return (
                                <div key={idx} className="mb-8">
                                    <h3 className="px-4 text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-4">
                                        {section.title}
                                    </h3>
                                    <div className="space-y-1">
                                        {filteredItems.map((item) => {
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
                            );
                        })}
                    </nav>
                </aside>

                {/* Main Content Area */}
                <main className="relative z-10 flex-1 min-w-0">
                    <div className="flex flex-col min-w-0">
                        <div className="scroll-content-container relative z-10 flex-1 min-h-0">
                            <div className="max-w-[900px] mx-auto px-8 py-16 min-w-0">
                                <article className="markdown-content bg-black prose prose-invert max-w-none">
                                    <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
                                </article>

                                {/* Navigation Footer */}
                                <footer className="mt-24 pt-12 border-t border-white/[0.05] grid grid-cols-2 gap-8">
                                    {getNavigationPages(activeSection).previous ? (
                                        <button
                                            onClick={() => navigateToPage(getNavigationPages(activeSection).previous!.id)}
                                            className="p-6 rounded-2xl cursor-pointer bg-white/[0.08] border border-white/[0.05] hover:border-white/20 transition-all text-left group"
                                        >
                                            <span className="text-xs text-zinc-600 flex items-center gap-2 mb-2"><FaChevronLeft size={14} /> Previous</span>
                                            <div className="text-zinc-400 font-bold group-hover:text-white transition-colors">{getNavigationPages(activeSection).previous!.label}</div>
                                        </button>
                                    ) : <div />}

                                    {getNavigationPages(activeSection).next ? (
                                        <button
                                            onClick={() => navigateToPage(getNavigationPages(activeSection).next!.id)}
                                            className="p-6 rounded-2xl cursor-pointer bg-white/[0.08] border border-white/[0.05] hover:border-white/20 transition-all text-right group"
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

                {/* Sidebar Direita */}
                <aside className="z-20 w-72 min-w-72 max-w-72 h-[calc(100vh-8rem)] mb-6 mr-6 sticky top-24 self-start hidden xl:flex flex-col flex-none bg-black backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl">
                    <div className="h-full p-8 overflow-y-auto custom-scrollbar">
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

            <Footer />
        </div>
    );
}

export function generateMetadata(params: any): Metadata {
    const isFrameworkParam = params?.value2 === 'react' || params?.value2 === 'vue';
    const pageId = isFrameworkParam ? (params?.value3 || 'introduction') : (params?.value2 || 'introduction');

    const currentItem = sidebarConfig.sections.flatMap(s => s.items).find(i => i.id === pageId);
    return {
        title: `Vatts.js | Docs - ${currentItem?.label || 'Documentation'}`
    }
}