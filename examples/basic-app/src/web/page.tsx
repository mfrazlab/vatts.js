import React, { useState, useEffect, useMemo } from 'react';


// Limite de peso para considerar um arquivo "pesado" (em KB)
const HEAVY_THRESHOLD = 500;

interface Asset {
    id: string;
    name: string;
    path: string;
    size: number;
    duration: string;
    category: string;
    protocol: string;
    initiator: string;
    startTime: string;
    isHeavy: boolean;
}

const ResourceAnalyzer = () => {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');

    const getCategory = (res: PerformanceResourceTiming) => {
        const name = res.name.toLowerCase();
        const type = res.initiatorType;

        if (type === 'script' || name.endsWith('.js') || name.endsWith('.mjs')) return 'script';
        if (type === 'img' || type === 'image' || /\.(png|jpe?g|gif|svg|webp|avif|ico)$/.test(name)) return 'image';
        if (type === 'css' || type === 'link' || name.endsWith('.css')) return 'style';
        if (type === 'font' || /\.(woff2?|ttf|otf|eot)$/.test(name)) return 'font';
        if (type === 'fetch' || type === 'xmlhttprequest') return 'api';
        return 'other';
    };

    const scanAssets = () => {
        const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

        const mappedAssets = resources.map(res => {
            const name = res.name.split('/').pop() || res.name;
            const sizeKB = res.encodedBodySize / 1024;
            const category = getCategory(res);
            const size = sizeKB > 0 ? sizeKB : (res.transferSize / 1024);

            return {
                id: `${res.name}-${res.startTime}`,
                name: name || 'Resource',
                path: res.name,
                size: size,
                duration: res.duration.toFixed(0),
                category,
                protocol: res.nextHopProtocol || 'h2',
                initiator: res.initiatorType,
                startTime: res.startTime.toFixed(0),
                isHeavy: size > HEAVY_THRESHOLD
            };
        }).sort((a, b) => b.size - a.size);

        setAssets(mappedAssets);
    };

    useEffect(() => {
        scanAssets();
        const observer = new PerformanceObserver(() => scanAssets());
        observer.observe({ entryTypes: ['resource'] });

        return () => observer.disconnect();
    }, []);

    const stats = useMemo(() => {
        const totalSize = assets.reduce((acc, curr) => acc + curr.size, 0);
        const avgLoadTime = assets.length ? assets.reduce((acc, curr) => acc + parseFloat(curr.duration), 0) / assets.length : 0;
        const heavyFiles = assets.filter(a => a.isHeavy).length;

        return {
            totalSize,
            avgLoadTime,
            totalRequests: assets.length,
            images: assets.filter(a => a.category === 'image').length,
            scripts: assets.filter(a => a.category === 'script').length,
            heavyFiles
        };
    }, [assets]);

    const filteredAssets = useMemo(() => {
        return assets.filter(asset => {
            const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                asset.path.toLowerCase().includes(searchTerm.toLowerCase());

            if (activeFilter === 'heavy') return matchesSearch && asset.isHeavy;
            const matchesFilter = activeFilter === 'all' || asset.category === activeFilter;

            return matchesSearch && matchesFilter;
        });
    }, [assets, searchTerm, activeFilter]);

    return (

            <div className="min-h-screen bg-black text-[#ededed] font-sans selection:bg-white/20">
                {/* Navbar */}
                <nav className="border-b border-white/10 px-6 py-3 flex items-center justify-between bg-black/50 backdrop-blur-md sticky top-0 z-50">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                                <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[8px] border-b-black mb-0.5"></div>
                            </div>
                            <span className="text-white font-medium text-sm">User's analyzer</span>
                            <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-gray-400 font-bold uppercase tracking-wider">PRO</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {stats.heavyFiles > 0 && (
                            <div className="flex items-center bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5 gap-2 animate-pulse">
                                <span className="text-[10px] text-red-500 font-bold uppercase">{stats.heavyFiles} Heavy Assets!</span>
                            </div>
                        )}
                        <div className="w-8 h-8 rounded-full border border-white/20 overflow-hidden">

                        </div>
                    </div>
                </nav>

                {/* Tabs / Filters */}
                <div className="border-b border-white/10 px-6 overflow-x-auto bg-black/30 custom-scrollbar-hide">
                    <div className="flex gap-6 text-sm text-gray-400 pt-3">
                        {[
                            { id: 'all', label: 'All Resources' },
                            { id: 'script', label: 'JS/Modules' },
                            { id: 'style', label: 'CSS/Styles' },
                            { id: 'image', label: 'Images' },
                            { id: 'api', label: 'API/Fetch' },
                            { id: 'heavy', label: '⚠️ Heavy Only', special: true }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveFilter(tab.id)}
                                className={`pb-3 border-b transition-all whitespace-nowrap ${
                                    activeFilter === tab.id
                                        ? (tab.special ? 'text-red-500 border-red-500' : 'text-white border-white')
                                        : `border-transparent hover:text-${tab.special ? 'red-400' : 'white'}`
                                } ${tab.special ? 'font-bold' : ''}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <main className="p-6 max-w-7xl mx-auto space-y-8 relative z-10">
                    {/* Search */}
                    <div className="flex justify-between items-center gap-4">
                        <div className="relative w-full max-w-xl">
                            <input
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                type="text"
                                placeholder="Search resources (name, path, initiator...)"
                                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-white/30 transition-all"
                            />
                            <svg className="absolute left-3 top-2.5 text-gray-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </div>
                        <button onClick={() => {window?.location.reload()}} className="cursor-pointer bg-white text-black px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors shrink-0">
                            Refresh Scan
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        {/* Assets List */}
                        <div className="lg:col-span-3 space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Live Assets ({filteredAssets.length})</h2>
                                {activeFilter === 'heavy' && (
                                    <span className="text-[10px] text-red-500 font-bold uppercase tracking-widest">Filtering by critical weight</span>
                                )}
                            </div>

                            {filteredAssets.map((asset) => (
                                <div
                                    key={asset.id}
                                    className={`group bg-white/[0.02] border rounded-xl p-5 hover:border-white/20 transition-all cursor-pointer relative overflow-hidden ${
                                        asset.isHeavy ? 'border-red-500/40 bg-red-500/[0.02]' : 'border-white/10'
                                    }`}
                                >
                                    {asset.isHeavy && (
                                        <div className="absolute top-0 right-0 px-3 py-1 bg-red-500 text-white text-[9px] font-black uppercase tracking-tighter">
                                            Heavy Resource
                                        </div>
                                    )}

                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center border border-white/5 shrink-0">
                                                {asset.category === 'script' && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow-500"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>}
                                                {asset.category === 'image' && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-pink-500"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>}
                                                {asset.category === 'style' && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>}
                                                {asset.category === 'api' && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-500"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>}
                                                {!['script', 'image', 'style', 'api'].includes(asset.category) && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>}
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-medium text-[15px] group-hover:underline truncate">{asset.name}</h3>
                                                <p className="text-xs text-gray-500 font-mono truncate max-w-lg">{asset.path}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 bg-white/5 font-bold uppercase text-gray-400">
                        {asset.initiator}
                      </span>
                                            <span className="text-[11px] text-gray-500 font-mono">{asset.protocol}</span>
                                        </div>
                                    </div>

                                    <div className="mt-6 flex items-center gap-6 text-xs text-gray-400">
                                        <div className={`flex items-center gap-1.5 ${asset.isHeavy ? 'text-red-400 font-bold' : ''}`}>
                                            <div className={`w-2 h-2 rounded-full ${asset.isHeavy ? 'bg-red-500 animate-pulse' : 'bg-blue-500'}`}></div>
                                            {asset.size.toFixed(2)} KB
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                            {asset.duration}ms
                                        </div>
                                        <div className="text-[10px] text-gray-600 uppercase font-bold tracking-tighter">
                                            Start: {asset.startTime}ms
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Sidebar Stats */}
                        <div className="space-y-6">
                            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Performance Insights</h2>
                            <div className="bg-white/[0.02] border border-white/10 rounded-xl p-5 space-y-6">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-400">Total Page Weight</span>
                                        <span className="text-white font-mono">{(stats.totalSize / 1024).toFixed(2)} MB</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-white transition-all duration-500" style={{ width: `${Math.min((stats.totalSize / 5000 * 100), 100)}%` }}></div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-400">Avg. Response Time</span>
                                        <span className="text-white font-mono">{stats.avgLoadTime.toFixed(0)}ms</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: '45%' }}></div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-white/5 flex flex-col gap-3">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-400">Total Requests</span>
                                        <span className="text-white">{stats.totalRequests}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-400">Critical Weight (&gt;500KB)</span>
                                        <span className={`${stats.heavyFiles > 0 ? 'text-red-500 font-black' : 'text-green-500'} font-bold`}>{stats.heavyFiles}</span>
                                    </div>
                                </div>


                            </div>

                            {stats.heavyFiles > 0 ? (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5 border-l-4 border-l-red-500">
                                    <h4 className="text-sm font-bold text-red-500 mb-1 flex items-center gap-2">
                                        ⚠️ Performance Alert
                                    </h4>
                                    <p className="text-xs text-gray-400 mb-4">You have {stats.heavyFiles} files slowing down the page. This might increase bounce rate on mobile devices.</p>
                                    <button onClick={() => setActiveFilter('heavy')} className="text-xs text-white underline decoration-white/30 hover:decoration-white transition-all">Inspect heavy files</button>
                                </div>
                            ) : (
                                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-5 border-l-4 border-l-green-500">
                                    <h4 className="text-sm font-bold text-green-500 mb-1 flex items-center gap-2">
                                        ✅ System Optimized
                                    </h4>
                                    <p className="text-xs text-gray-400">No critical assets detected. Everything is within the safe weight limits.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </main>

                <div className="fixed inset-0 pointer-events-none grid-bg z-0"></div>

                <style>{`
          .grid-bg {
            background-image:
                linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
            background-size: 60px 60px;
            mask-image: radial-gradient(circle at center, black, transparent 90%);
          }
          .custom-scrollbar-hide {
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          .custom-scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
        `}</style>
            </div>

    );
};

export default ResourceAnalyzer;