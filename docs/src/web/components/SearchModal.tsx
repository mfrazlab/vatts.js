import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Globe, Search, X, FileText, Command } from 'lucide-react';
import type { SearchDoc, SearchHit } from '../lib/searchIndex';
import { searchDocs } from '../lib/searchIndex';
import { Link } from "vatts/react";

export type SearchModalProps = {
    open: boolean;
    onClose: () => void;
    docs: SearchDoc[];
    placeholder?: string;
    /** Optional initial query when opening */
    initialQuery?: string;
};

export default function SearchModal({
                                        open,
                                        onClose,
                                        docs,
                                        placeholder = 'Search documentation...',
                                        initialQuery = '',
                                    }: SearchModalProps) {
    const [query, setQuery] = useState(initialQuery);
    const inputRef = useRef<HTMLInputElement | null>(null);

    // Cores do tema
    const primaryColor = "#ff6b35";
    const primaryRgb = "255, 107, 53";

    useEffect(() => {
        if (!open) return;
        setQuery(initialQuery);
        // focus after paint
        setTimeout(() => inputRef.current?.focus(), 0);
    }, [open, initialQuery]);

    useEffect(() => {
        if (!open) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, onClose]);

    const results: SearchHit[] = useMemo(() => {
        if (!query.trim()) return [];
        return searchDocs(docs, query, 10);
    }, [docs, query]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[18vh] px-4">
            {/* Backdrop com Blur mais intenso */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

            <div className="relative w-full max-w-2xl bg-[#0a0a0c] border border-white/10 rounded-2xl shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Linha Neon no topo para consistência */}
                <div className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${primaryColor}, transparent)` }} />

                <div className="flex items-center px-6 py-5 border-b border-white/5">
                    <Search className="w-5 h-5 text-slate-500 mr-4" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder={placeholder}
                        className="flex-1 bg-transparent border-none outline-none text-white placeholder-slate-600 font-medium text-lg h-8"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-colors group">
                            <X className="w-5 h-5 text-slate-500 group-hover:text-white" />
                        </button>
                    </div>
                </div>

                <div className="max-h-[50vh] overflow-y-auto p-3 custom-scrollbar">
                    {results.length > 0 ? (
                        <div className="space-y-1">
                            {results.map((r) => (
                                <Link
                                    key={r.href}
                                    href={r.href}
                                    className="block px-4 py-4 rounded-xl hover:bg-white/[0.03] group cursor-pointer transition-all border border-transparent hover:border-white/5"
                                    onClick={onClose}
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div
                                                className="p-2.5 rounded-xl bg-white/5 transition-colors flex-none"
                                                style={{ color: primaryColor }}
                                            >
                                                <FileText size={18} />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-white font-bold text-base truncate group-hover:text-[#ff8559] transition-colors">
                                                    {r.label}
                                                </div>
                                                {r.category ? (
                                                    <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mt-0.5">
                                                        {r.category}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                        <ArrowRight className="w-5 h-5 text-slate-700 group-hover:text-[#ff6b35] transition-all transform group-hover:translate-x-1" />
                                    </div>
                                    {r.snippet ? (
                                        <div className="mt-3 text-sm text-slate-500 line-clamp-2 leading-relaxed pl-[52px]">
                                            {r.snippet}
                                        </div>
                                    ) : null}
                                </Link>
                            ))}
                        </div>
                    ) : query.trim() ? (
                        <div className="py-12 text-center">
                            <div className="inline-flex p-4 rounded-full bg-white/5 mb-4">
                                <Search className="w-8 h-8 text-slate-700" />
                            </div>
                            <div className="text-slate-400 font-medium">No results found for "{query}"</div>
                            <p className="text-slate-600 text-sm mt-1">Try searching for different keywords.</p>
                        </div>
                    ) : (
                        <div className="py-12 text-center">
                            <p className="text-slate-500 font-medium mb-6">What are you looking for?</p>
                            <div className="flex flex-wrap justify-center gap-3">
                                {['Installation', 'Auth Providers', 'RPC System', 'Routing'].map(tag => (
                                    <button
                                        key={tag}
                                        onClick={() => setQuery(tag)}
                                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-all"
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer do Modal */}
                <div className="px-6 py-4 border-t border-white/5 bg-white/[0.01] flex justify-between items-center text-[10px] font-bold uppercase tracking-[0.1em] text-slate-600">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5">
                            <kbd className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-md text-slate-400">ESC</kbd>
                            <span>to close</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                            <kbd className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-md text-slate-400">
                                <ArrowRight size={10} className="rotate-90" />
                            </kbd>
                            <span>to navigate</span>
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Command size={12} />
                        <span>Vatts Search</span>
                    </div>
                </div>
            </div>
        </div>
    );
}