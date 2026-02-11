<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import SearchModal from "./SearchModal.vue"; // Assumindo extensão .vue
import { VattsImage, Link, router } from "vatts/vue";
import { sidebarConfig } from "../lib/searchIndex";
import type { SearchDoc } from "../lib/searchIndex";

// JSON com os links da Navbar
const navLinks = [
  { label: "Docs", href: "/docs", external: false },
  { label: "Npm", href: "https://npmjs.com/vatts", external: true }
];

const isSearchOpen = ref(false);
const currentPath = ref('');

// Computed property para substituir o useMemo
const docsForSearch = computed<SearchDoc[]>(() => {
  return sidebarConfig.sections.flatMap((section) =>
      section.items.map((item) => ({
        id: item.id,
        label: item.label,
        category: section.title,
        href: `/docs/${section.id}/${item.id}`,
        // Type assertion mantido do original
        content: typeof (item as any).file === 'string' ? (item as any).file : '',
      }))
  );
});

// Computed para links ativos baseado no currentPath
const activeLinksComputed = computed(() => {
  const active: { [key: string]: boolean } = {};
  navLinks.forEach((link) => {
    active[link.href] = !link.external && !!currentPath.value && currentPath.value.startsWith(link.href);
  });
  return active;
});

// Função auxiliar para verificar link ativo
const isActiveLink = (href: string, external: boolean) => {
  return activeLinksComputed.value[href] || false;
};

const getLinkClasses = (href: string, external: boolean) => {
  const active = isActiveLink(href, external);
  return active
      ? "text-blue-500 font-semibold"
      : "text-slate-400 hover:text-white";
};

// Watcher para detectar mudanças de rota
watch(() => typeof window !== 'undefined' ? window.location.href : '', (newHref) => {
  console.log('MUDOU')
  if (typeof window !== 'undefined') {
    currentPath.value = window.location.pathname;
  }
}, { immediate: true });

const handleKeyDown = (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    isSearchOpen.value = true;
  }
  if (e.key === 'Escape') isSearchOpen.value = false;
};

onMounted(() => {
  if (typeof window !== 'undefined') {
    currentPath.value = window.location.pathname;
    window.addEventListener('keydown', handleKeyDown);
  }
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeyDown);
  }
});
</script>

<template>
  <SearchModal
      :open="isSearchOpen"
      @close="isSearchOpen = false"
      :docs="docsForSearch"
      placeholder="Search documentation..."
  />

  <nav class="sticky top-0 z-50 w-full border-b border-white/[0.05] bg-[#0d0d0d]/80 backdrop-blur-md">
    <div class="flex h-16 items-center justify-between px-6 max-w-7xl mx-auto">
      <div class="flex items-center gap-6">
        <Link href="/" class="relative group cursor-pointer flex items-center gap-3 mr-3">
          <VattsImage
              src="/logo-all-white.png"
              height="32px"
              alt="Vatts"
              class="relative rounded-lg"
          />
        </Link>

        <template v-for="link in navLinks" :key="link.label">
          <a
              v-if="link.external"
              :href="link.href"
              class="text-sm font-medium transition-colors"
              :class="getLinkClasses(link.href, link.external)"
          >
            {{ link.label }}
          </a>

          <Link
              v-else
              :href="link.href"
              class="text-sm font-medium transition-colors"
              :class="getLinkClasses(link.href, link.external)"
          >
            {{ link.label }}
          </Link>
        </template>
      </div>

      <div class="flex items-center gap-4">
        <button
            @click="isSearchOpen = true"
            class="hidden md:flex items-center gap-3 bg-white/[0.05] border border-white/10 rounded-md px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:border-[#ff6b35]/30 transition-all w-64 group"
        >
          <span class="flex-1 text-left">Search docs...</span>
          <div class="flex gap-1 text-[10px] opacity-50">
            <kbd class="bg-black/20 border border-white/10 px-1.5 rounded">Ctrl</kbd>
            <kbd class="bg-black/20 border border-white/10 px-1.5 rounded">K</kbd>
          </div>
        </button>

        <a
            href="https://github.com/mfrazlab/vatts.js"
            class="text-slate-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full"
            target="_blank"
            rel="noreferrer"
        >
          <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 496 512"
              fill="currentColor"
          >
            <path d="M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3.7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3.3 2.9 2.3 3.9 1.6 1 3.6.7 4.3-.7.7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3.7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3.7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z"/>
          </svg>
        </a>
      </div>
    </div>
  </nav>
</template>