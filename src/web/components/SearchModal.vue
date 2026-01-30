<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { Link } from "vatts/vue"; // Import ajustado para vatts/vue
import type { SearchDoc, SearchHit } from '../lib/searchIndex';
import { searchDocs } from '../lib/searchIndex';

// Props Definition
const props = withDefaults(defineProps<{
  open: boolean;
  docs: SearchDoc[];
  placeholder?: string;
  initialQuery?: string;
}>(), {
  placeholder: 'Search documentation...',
  initialQuery: ''
});

// Emits Definition
const emit = defineEmits<{
  (e: 'close'): void;
}>();

// State
const query = ref(props.initialQuery);
const inputRef = ref<HTMLInputElement | null>(null);
const primaryColor = "#ff6b35";

// Computed Search Results
const results = computed<SearchHit[]>(() => {
  if (!query.value.trim()) return [];
  return searchDocs(props.docs, query.value, 10);
});

// Handlers
const onClose = () => {
  emit('close');
};

// Watchers
watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    query.value = props.initialQuery;
    // Espera o DOM atualizar (renderizar o modal) antes de focar
    await nextTick();
    inputRef.value?.focus();
  }
});

// Global Keyboard Events
const onKeyDown = (e: KeyboardEvent) => {
  if (!props.open) return;
  if (e.key === 'Escape') onClose();
};

onMounted(() => {
  window.addEventListener('keydown', onKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown);
});
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-[100] flex items-start justify-center pt-[18vh] px-4">
    <div class="absolute inset-0 bg-black/80 backdrop-blur-md" @click="onClose"></div>

    <div class="relative w-full max-w-2xl bg-[#0a0a0c] border border-white/10 rounded-2xl shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">

      <div class="h-px w-full" :style="{ background: `linear-gradient(90deg, transparent, ${primaryColor}, transparent)` }"></div>

      <div class="flex items-center px-6 py-5 border-b border-white/5">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 text-slate-500 mr-4">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
        </svg>

        <input
            ref="inputRef"
            type="text"
            :placeholder="placeholder"
            class="flex-1 bg-transparent border-none outline-none text-white placeholder-slate-600 font-medium text-lg h-8"
            v-model="query"
        />

        <div class="flex items-center gap-3">
          <button @click="onClose" class="p-2 hover:bg-white/5 rounded-xl transition-colors group">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 text-slate-500 group-hover:text-white">
              <path d="M18 6 6 18"/><path d="m6 6 18 18"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="max-h-[50vh] overflow-y-auto p-3 custom-scrollbar">

        <div v-if="results.length > 0" class="space-y-1">
          <Link
              v-for="r in results"
              :key="r.href"
              :href="r.href"
              class="block px-4 py-4 rounded-xl hover:bg-white/[0.03] group cursor-pointer transition-all border border-transparent hover:border-white/5"
              @click="onClose"
          >
            <div class="flex items-center justify-between gap-4">
              <div class="flex items-center gap-4 min-w-0">
                <div
                    class="p-2.5 rounded-xl bg-white/5 transition-colors flex-none"
                    :style="{ color: primaryColor }"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
                <div class="min-w-0">
                  <div class="text-white font-bold text-base truncate group-hover:text-[#ff8559] transition-colors">
                    {{ r.label }}
                  </div>
                  <div v-if="r.category" class="text-xs font-bold uppercase tracking-widest text-slate-500 mt-0.5">
                    {{ r.category }}
                  </div>
                </div>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 text-slate-700 group-hover:text-[#ff6b35] transition-all transform group-hover:translate-x-1">
                <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
              </svg>
            </div>
            <div v-if="r.snippet" class="mt-3 text-sm text-slate-500 line-clamp-2 leading-relaxed pl-[52px]">
              {{ r.snippet }}
            </div>
          </Link>
        </div>

        <div v-else-if="query.trim()" class="py-12 text-center">
          <div class="inline-flex p-4 rounded-full bg-white/5 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-700">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
          </div>
          <div class="text-slate-400 font-medium">No results found for "{{ query }}"</div>
          <p class="text-slate-600 text-sm mt-1">Try searching for different keywords.</p>
        </div>

        <div v-else class="py-12 text-center">
          <p class="text-slate-500 font-medium mb-6">What are you looking for?</p>
          <div class="flex flex-wrap justify-center gap-3">
            <button
                v-for="tag in ['Installation', 'Auth Providers', 'RPC System', 'Routing']"
                :key="tag"
                @click="query = tag"
                class="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-all"
            >
              {{ tag }}
            </button>
          </div>
        </div>
      </div>

      <div class="px-6 py-4 border-t border-white/5 bg-white/[0.01] flex justify-between items-center text-[10px] font-bold uppercase tracking-[0.1em] text-slate-600">
        <div class="flex items-center gap-4">
                    <span class="flex items-center gap-1.5">
                        <kbd class="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-md text-slate-400">ESC</kbd>
                        <span>to close</span>
                    </span>
          <span class="flex items-center gap-1.5">
                        <kbd class="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-md text-slate-400">
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="rotate-90">
                                <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                            </svg>
                        </kbd>
                        <span>to navigate</span>
                    </span>
        </div>
        <div class="flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"/>
          </svg>
          <span>Vatts Search</span>
        </div>
      </div>
    </div>
  </div>
</template>