<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {router} from "vatts/vue";

// Definição de Tipos
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

// Constantes
const HEAVY_THRESHOLD = 500;

// Estado Reativo
const assets = ref<Asset[]>([]);
const searchTerm = ref('');
const activeFilter = ref('all');

// Configuração das Tabs
const tabs = [
  { id: 'all', label: 'All Resources' },
  { id: 'script', label: 'JS/Modules' },
  { id: 'style', label: 'CSS/Styles' },
  { id: 'image', label: 'Images' },
  { id: 'api', label: 'API/Fetch' },
  { id: 'heavy', label: '⚠️ Heavy Only', special: true }
];

// Lógica de Negócio
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
  // Verificação de segurança para ambiente SSR ou sem window
  if (typeof performance === 'undefined') return;

  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

  const mappedAssets = resources.map(res => {
    const name = res.name.split('/').pop() || res.name;
    const sizeKB = res.encodedBodySize / 1024;
    const category = getCategory(res);
    // Fallback para transferSize se encodedBodySize for 0 (comum em cross-origin ou cache)
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

  assets.value = mappedAssets;
};

// Computed Properties (Substituindo useMemo)
const stats = computed(() => {
  const totalSize = assets.value.reduce((acc, curr) => acc + curr.size, 0);
  const avgLoadTime = assets.value.length
      ? assets.value.reduce((acc, curr) => acc + parseFloat(curr.duration), 0) / assets.value.length
      : 0;
  const heavyFiles = assets.value.filter(a => a.isHeavy).length;

  return {
    totalSize,
    avgLoadTime,
    totalRequests: assets.value.length,
    images: assets.value.filter(a => a.category === 'image').length,
    scripts: assets.value.filter(a => a.category === 'script').length,
    heavyFiles
  };
});

const filteredAssets = computed(() => {
  return assets.value.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
        asset.path.toLowerCase().includes(searchTerm.value.toLowerCase());

    if (activeFilter.value === 'heavy') return matchesSearch && asset.isHeavy;
    const matchesFilter = activeFilter.value === 'all' || asset.category === activeFilter.value;

    return matchesSearch && matchesFilter;
  });
});

// Lifecycle Hooks (Substituindo useEffect)
let observer: PerformanceObserver | null = null;

onMounted(() => {
  scanAssets();

  if (typeof PerformanceObserver !== 'undefined') {
    observer = new PerformanceObserver(() => scanAssets());
    observer.observe({ entryTypes: ['resource'] });
  }
});

onUnmounted(() => {
  if (observer) observer.disconnect();
});
function refresh() {
  console.log('tentando')
  window.location.reload()
}

</script>

<template>
  <div class="min-h-screen bg-black text-[#ededed] font-sans selection:bg-white/20">

    <nav class="border-b border-white/10 px-6 py-3 flex items-center justify-between bg-black/50 backdrop-blur-md sticky top-0 z-50">
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 bg-white rounded-full flex items-center justify-center">
            <div class="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[8px] border-b-black mb-0.5"></div>
          </div>
          <span class="text-white font-medium text-sm">User's analyzer</span>
          <span class="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-gray-400 font-bold uppercase tracking-wider">PRO</span>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <div v-if="stats.heavyFiles > 0" class="flex items-center bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5 gap-2 animate-pulse">
          <span class="text-[10px] text-red-500 font-bold uppercase">{{ stats.heavyFiles }} Heavy Assets!</span>
        </div>
        <div class="w-8 h-8 rounded-full border border-white/20 overflow-hidden">
        </div>
      </div>
    </nav>

    <div class="border-b border-white/10 px-6 overflow-x-auto bg-black/30 custom-scrollbar-hide">
      <div class="flex gap-6 text-sm text-gray-400 pt-3">
        <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="activeFilter = tab.id"
            class="pb-3 border-b transition-all whitespace-nowrap"
            :class="[
            activeFilter === tab.id
              ? (tab.special ? 'text-red-500 border-red-500' : 'text-white border-white')
              : `border-transparent hover:text-${tab.special ? 'red-400' : 'white'}`,
            tab.special ? 'font-bold' : ''
          ]"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <main class="p-6 max-w-7xl mx-auto space-y-8 relative z-10">
      <div class="flex justify-between items-center gap-4">
        <div class="relative w-full max-w-xl">
          <input
              v-model="searchTerm"
              type="text"
              placeholder="Search resources (name, path, initiator...)"
              class="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-white/30 transition-all"
          />
          <svg class="absolute left-3 top-2.5 text-gray-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
        <button @click="refresh" class="bg-white text-black cursor-pointer px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors shrink-0">
          Refresh Scan
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div class="lg:col-span-3 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-widest">Live Assets ({{ filteredAssets.length }})</h2>
            <span v-if="activeFilter === 'heavy'" class="text-[10px] text-red-500 font-bold uppercase tracking-widest">
              Filtering by critical weight
            </span>
          </div>

          <div
              v-for="asset in filteredAssets"
              :key="asset.id"
              class="group bg-white/[0.02] border rounded-xl p-5 hover:border-white/20 transition-all cursor-pointer relative overflow-hidden"
              :class="asset.isHeavy ? 'border-red-500/40 bg-red-500/[0.02]' : 'border-white/10'"
          >
            <div v-if="asset.isHeavy" class="absolute top-0 right-0 px-3 py-1 bg-red-500 text-white text-[9px] font-black uppercase tracking-tighter">
              Heavy Resource
            </div>

            <div class="flex items-start justify-between">
              <div class="flex items-center gap-4 min-w-0">
                <div class="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center border border-white/5 shrink-0">
                  <svg v-if="asset.category === 'script'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" class="text-yellow-500">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                    <polyline points="13 2 13 9 20 9"></polyline>
                  </svg>

                  <svg v-else-if="asset.category === 'image'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" class="text-pink-500">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>

                  <svg v-else-if="asset.category === 'style'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" class="text-blue-500">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>

                  <svg v-else-if="asset.category === 'api'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" class="text-green-500">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                  </svg>

                  <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" class="text-gray-400">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  </svg>
                </div>
                <div class="min-w-0">
                  <h3 class="font-medium text-[15px] group-hover:underline truncate">{{ asset.name }}</h3>
                  <p class="text-xs text-gray-500 font-mono truncate max-w-lg">{{ asset.path }}</p>
                </div>
              </div>
              <div class="flex flex-col items-end gap-2 shrink-0">
                <span class="text-[10px] px-2 py-0.5 rounded-full border border-white/10 bg-white/5 font-bold uppercase text-gray-400">
                  {{ asset.initiator }}
                </span>
                <span class="text-[11px] text-gray-500 font-mono">{{ asset.protocol }}</span>
              </div>
            </div>

            <div class="mt-6 flex items-center gap-6 text-xs text-gray-400">
              <div class="flex items-center gap-1.5" :class="{ 'text-red-400 font-bold': asset.isHeavy }">
                <div class="w-2 h-2 rounded-full" :class="asset.isHeavy ? 'bg-red-500 animate-pulse' : 'bg-blue-500'"></div>
                {{ asset.size.toFixed(2) }} KB
              </div>
              <div class="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                {{ asset.duration }}ms
              </div>
              <div class="text-[10px] text-gray-600 uppercase font-bold tracking-tighter">
                Start: {{ asset.startTime }}ms
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-6">
          <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-widest">Performance Insights</h2>
          <div class="bg-white/[0.02] border border-white/10 rounded-xl p-5 space-y-6">
            <div class="space-y-2">
              <div class="flex justify-between text-xs">
                <span class="text-gray-400">Total Page Weight</span>
                <span class="text-white font-mono">{{ (stats.totalSize / 1024).toFixed(2) }} MB</span>
              </div>
              <div class="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div class="h-full bg-white transition-all duration-500" :style="{ width: `${Math.min((stats.totalSize / 5000 * 100), 100)}%` }"></div>
              </div>
            </div>

            <div class="space-y-2">
              <div class="flex justify-between text-xs">
                <span class="text-gray-400">Avg. Response Time</span>
                <span class="text-white font-mono">{{ stats.avgLoadTime.toFixed(0) }}ms</span>
              </div>
              <div class="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div class="h-full bg-blue-500 transition-all duration-500" style="width: 45%"></div>
              </div>
            </div>

            <div class="pt-4 border-t border-white/5 flex flex-col gap-3">
              <div class="flex justify-between text-xs">
                <span class="text-gray-400">Total Requests</span>
                <span class="text-white">{{ stats.totalRequests }}</span>
              </div>
              <div class="flex justify-between text-xs">
                <span class="text-gray-400">Critical Weight (&gt;500KB)</span>
                <span :class="[stats.heavyFiles > 0 ? 'text-red-500 font-black' : 'text-green-500', 'font-bold']">
                  {{ stats.heavyFiles }}
                </span>
              </div>
            </div>

          </div>

          <div v-if="stats.heavyFiles > 0" class="bg-red-500/10 border border-red-500/20 rounded-xl p-5 border-l-4 border-l-red-500">
            <h4 class="text-sm font-bold text-red-500 mb-1 flex items-center gap-2">
              ⚠️ Performance Alert
            </h4>
            <p class="text-xs text-gray-400 mb-4">You have {{ stats.heavyFiles }} files slowing down the page. This might increase bounce rate on mobile devices.</p>
            <button @click="activeFilter = 'heavy'" class="text-xs text-white underline decoration-white/30 hover:decoration-white transition-all">
              Inspect heavy files
            </button>
          </div>

          <div v-else class="bg-green-500/10 border border-green-500/20 rounded-xl p-5 border-l-4 border-l-green-500">
            <h4 class="text-sm font-bold text-green-500 mb-1 flex items-center gap-2">
              ✅ System Optimized
            </h4>
            <p class="text-xs text-gray-400">No critical assets detected. Everything is within the safe weight limits.</p>
          </div>
        </div>
      </div>
    </main>

    <div class="fixed inset-0 pointer-events-none grid-bg z-0"></div>
  </div>
</template>

<style scoped>
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
</style>