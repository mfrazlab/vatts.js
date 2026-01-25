import SearchModal from "./SearchModal";
import {VattsImage} from "vatts/react";
import {Link} from "vatts/react";
import {FaGithub} from "react-icons/fa6";
import React, {useEffect, useMemo, useState} from "react";
import type {SearchDoc} from "../lib/searchIndex";
import {sidebarConfig} from "../lib/searchIndex";

// JSON com os links da Navbar
const navLinks = [
    { label: "Docs", href: "/docs", external: false },
    { label: "Npm", href: "https://npmjs.com/vatts", external: true }
];

export default function Navbar() {
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [currentPath, setCurrentPath] = useState('');

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
        // Pega a URL atual para verificar o link ativo
        if (typeof window !== 'undefined') {
            setCurrentPath(window.location.pathname);
        }

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

    return <>
        <SearchModal
            open={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            docs={docsForSearch}
            placeholder="Search documentation..."
        />

        <nav className="sticky top-0 z-50 w-full border-b border-white/[0.05] bg-[#0d0d0d]/80 backdrop-blur-md">
            <div className="flex h-16 items-center justify-between px-6 max-w-7xl mx-auto">
                <div className="flex items-center gap-6">
                    <Link href="/" className="relative group cursor-pointer flex items-center gap-3 mr-3">
                        <VattsImage src="/logo-all-white.png" height={"32px"} alt="Vatts" className="relative rounded-lg" />
                    </Link>

                    {/* Renderização dos links via JSON com verificação de ativo */}
                    {navLinks.map((link) => {
                        const isActive = !link.external && currentPath.startsWith(link.href);
                        const activeClasses = isActive
                            ? "text-blue-500 font-semibold"
                            : "text-slate-400 hover:text-white";

                        if (link.external) {
                            return (
                                <a key={link.label} href={link.href} className={`text-sm font-medium transition-colors ${activeClasses}`}>
                                    {link.label}
                                </a>
                            );
                        }

                        return (
                            <Link key={link.label} href={link.href} className={`text-sm font-medium transition-colors ${activeClasses}`}>
                                {link.label}
                            </Link>
                        );
                    })}
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
    </>
}