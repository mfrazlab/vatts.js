<script setup lang="ts">
import "./style.css"
import { ref, computed, watch, onMounted, nextTick } from 'vue';
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
import 'prismjs/components/prism-markup'; // Necessário para HTML/Vue

// Ícones Lucide (Substitutos para react-icons)
import {
  Zap, Book, BookOpen, Package, ChevronLeft, ChevronRight, ChevronDown,
  Download, FileText, Settings, GitCompare, Github, Globe, Palette,
  Shield, Wrench, Code, Lock, Box, Workflow, Home, Search, Cog
} from 'lucide-vue-next';

// Imports do framework Vatts
import {router} from "vatts/vue";
import { sidebarConfig } from "@/web/lib/searchIndex";

import Navbar from "../../../../components/Navbar.vue";
import Footer from "../../../../components/Footer.vue";

// Props devem vir DEPOIS dos imports
const props = defineProps({
  params: {
    type: Object,
    default: () => ({})
  }
});

// --- Configurações do Markdown e Prism (Fora do setup para performance) ---

const primaryColor = "#a8a8a8";

const generateId = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// Configuração do Renderer
const renderer = new marked.Renderer();

renderer.heading = ({ text, depth }: any) => {
  const id = generateId(text);
  return `<h${depth} id="${id}" class="group flex items-center gap-2">
            ${text}
            <a href="#${id}" class="opacity-0 group-hover:opacity-100 transition-opacity" style="color: ${primaryColor}">#</a>
          </h${depth}>`;
};

// Faz com que Prism.languages['vue'] deixe de ser undefined (Aliás para markup/html)
if (Prism.languages.markup) {
  Prism.languages.vue = Prism.languages.markup;
}

renderer.code = ({ text, lang }: any) => {
  // Verificação de segurança para evitar erro se a linguagem não existir
  // Normaliza 'vue' para 'markup' se necessário, ou usa plaintext
  let validLanguage = lang;
  if (!lang || !Prism.languages[lang]) {
    validLanguage = 'plaintext';
  }

  // Prism.highlight é geralmente seguro no Node, mas highlightAll não.
  // Mantemos isso síncrono para gerar o HTML estático corretamente.
  const highlighted = Prism.highlight(text, Prism.languages[validLanguage], validLanguage);

  return `
        <div class=" font-jmono code-block my-8 group relative rounded-xl border border-white/5 bg-[#0a0a0c]">
            <div class="code-header flex justify-between items-center px-4 py-2 bg-white/[0.03] rounded-t-xl border-b border-white/5">
                <span class="text-[10px] uppercase tracking-widest font-bold text-zinc-500">${lang || 'text'}</span>
                <button class="copy-button p-1 text-zinc-600 hover:text-white transition-colors" onclick="navigator.clipboard.writeText(this.getAttribute('data-code'))" data-code="${text.replace(/"/g, '&quot;')}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                </button>
            </div>
            <pre class="language-${validLanguage} !bg-transparent !m-0 !p-6 overflow-x-auto text-sm leading-relaxed"><code class="language-${validLanguage}">${highlighted}</code></pre>
        </div>
    `;
};

marked.setOptions({ renderer });

// Mapa de ícones
const iconMap: { [key: string]: any } = {
  FaCube: Box,
  FaDiagramProject: Workflow,
  FaHome: Home,
  FaDownload: Download,
  FaFile: FileText,
  FaCode: Code,
  FaCodeCompare: GitCompare,
  FaWrench: Wrench,
  FaBookOpen: BookOpen,
  FaGear: Settings,
  FaPalette: Palette,
  FaGlobe: Globe,
  FaBolt: Zap,
  FaBox: Package,
  FaBook: Book,
  FaShield: Shield,
  FaLock: Lock,
  FaCog: Cog
};

// --- Component Logic ---


// Extração de params da rota
// Assumindo que vatts/vue mapeia rotas dinâmicas para route.params
const brand = computed(() => props.params.value || 'vatts');
const isFrameworkParam = computed(() => props.params.value2 === 'react' || props.params.value2 === 'vue');

const initialFramework = isFrameworkParam.value ? props.params.value2 : 'react';
const initialPageId = isFrameworkParam.value ? (props.params.value3 || 'introduction') : (props.params.value2 || 'introduction');

// Estado
const activeSection = ref(initialPageId as string);
const framework = ref<'react' | 'vue'>(initialFramework as 'react' | 'vue');
const htmlContent = ref('');
const headings = ref<any[]>([]);
const isDropdownOpen = ref(false);


// Helpers de Navegação
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

const navigateToPage = (itemId: string, newFramework?: string) => {
  const targetFramework = newFramework || framework.value;
  const newUrl = `/docs/${brand.value}/${targetFramework}/${itemId}`;
  router.push(newUrl)
};


// Watcher principal para carregar e renderizar o conteúdo
watch([activeSection, framework], async () => {
  const currentItem = sidebarConfig.sections
      .flatMap(s => s.items)
      .find(i => i.id === activeSection.value);

  if (currentItem?.file) {
    const content = typeof currentItem.file === 'string'
        ? currentItem.file
        : (currentItem.file[framework.value] || currentItem.file['react']);

    htmlContent.value = marked.parse(content) as string;

    const headingRegex = /^(#{1,2})\s+(.+)$/gm;
    const matches = [...content.matchAll(headingRegex)];
    headings.value = matches.map((m: any) => ({ id: generateId(m[2]), text: m[2], level: m[1].length }));

    // Executar Prism.highlightAll apenas no cliente (browser) para garantir
    if (typeof window !== 'undefined') {
      await nextTick();
      Prism.highlightAll();
    }
  }
}, { immediate: true });

</script>

<template>
  <div class="font-dm relative min-h-screen bg-black text-slate-400 selection:bg-white/10 isolate flex flex-col">
    

    <div class="relative z-0 flex flex-1 min-w-0 bg-black">

      <aside class="z-20 w-80 min-w-80 max-w-80 h-[calc(100vh-8rem)] mb-6 ml-6 sticky top-24 self-start hidden lg:flex flex-col rounded-2xl flex-none overflow-hidden shadow-2xl">

        <div class="p-4 border-b border-white/5 relative">
          <button
              @click="isDropdownOpen = !isDropdownOpen"
              class="w-full cursor-pointer flex items-center justify-between p-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 rounded-xl transition-all group"
          >
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 shadow-inner">
                <template v-if="framework === 'react'">
                  <svg width="18" height="18" viewBox="-10.5 -9.45 21 18.9" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-sky-400"><circle cx="0" cy="0" r="2" fill="currentColor"></circle><g stroke="currentColor" stroke-width="1" fill="none"><ellipse rx="10" ry="4.5"></ellipse><ellipse rx="10" ry="4.5" transform="rotate(60)"></ellipse><ellipse rx="10" ry="4.5" transform="rotate(120)"></ellipse></g></svg>
                </template>
                <template v-else>
                  <svg width="18" height="18" viewBox="0 0 128 128" class="text-emerald-400" xmlns="http://www.w3.org/2000/svg"><path d="M78.8,10L64,35.4L49.2,10H0l64,110l64-110C128,10,78.8,10,78.8,10z" fill="#41B883"/><path d="M78.8,10L64,35.4L49.2,10H25.6L64,76l38.4-66H78.8z" fill="#35495E"/></svg>
                </template>
              </div>
              <div class="text-left">
                <p class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none mb-1">Using Framework</p>
                <p class="text-sm font-bold text-white leading-none capitalize">{{ framework }}</p>
              </div>
            </div>
            <ChevronDown :size="12" :class="`text-zinc-500 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`" />
          </button>

          <div v-if="isDropdownOpen" class="absolute top-[calc(100%-8px)] left-4 right-4 z-50 mt-2 p-1 bg-[#0f0f11] border border-white/10 rounded-xl shadow-2xl backdrop-blur-xl">
            <button
                @click="isDropdownOpen = false; navigateToPage(activeSection, 'react');"
                :class="`w-full cursor-pointer flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${framework === 'react' ? 'bg-white/5 text-white' : 'hover:bg-white/[0.03] text-zinc-400'}`"
            >
              <svg width="16" height="16" viewBox="-10.5 -9.45 21 18.9" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-sky-400"><circle cx="0" cy="0" r="2" fill="currentColor"></circle><g stroke="currentColor" stroke-width="1" fill="none"><ellipse rx="10" ry="4.5"></ellipse><ellipse rx="10" ry="4.5" transform="rotate(60)"></ellipse><ellipse rx="10" ry="4.5" transform="rotate(120)"></ellipse></g></svg>

              <span class="text-sm font-medium">React.js</span>
            </button>
            <button
                @click="isDropdownOpen = false; navigateToPage(activeSection, 'vue');"
                :class="`w-full cursor-pointer flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${framework === 'vue' ? 'bg-white/5 text-white' : 'hover:bg-white/[0.03] text-zinc-400'}`"
            >
              <svg width="16" height="16" viewBox="0 0 128 128" class="text-emerald-400" xmlns="http://www.w3.org/2000/svg"><path d="M78.8,10L64,35.4L49.2,10H0l64,110l64-110C128,10,78.8,10,78.8,10z" fill="#41B883"/><path d="M78.8,10L64,35.4L49.2,10H25.6L64,76l38.4-66H78.8z" fill="#35495E"/></svg>
              <span class="text-sm font-medium">Vue.js</span>
            </button>
          </div>
        </div>

        <nav class="flex-1 px-4 py-6 overflow-y-auto custom-scrollbar">
          <div v-for="(section, idx) in sidebarConfig.sections" :key="idx" class="mb-8">
            <h3 class="px-4 text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-4">
              {{ section.title }}
            </h3>
            <div class="space-y-1">
              <button
                  v-for="item in section.items"
                  :key="item.id"
                  @click="navigateToPage(item.id)"
                  :class="`w-full cursor-pointer flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 group ${
                  activeSection === item.id
                    ? 'bg-white/5 text-white ring-1 ring-white/10 shadow-[0_0_20px_-5px_rgba(255,255,255,0.1)]'
                    : 'hover:bg-white/[0.03] text-zinc-500 hover:text-zinc-200'
                }`"
              >
                <component :is="iconMap[item.icon] || FileText" :size="18" :class="activeSection === item.id ? 'text-white' : 'group-hover:text-zinc-300 transition-colors'" />
                <span class="text-sm font-medium tracking-wide truncate">{{ item.label }}</span>
              </button>
            </div>
          </div>
        </nav>
      </aside>

      <main class="relative z-10 flex-1 min-w-0">
        <div class="flex flex-col min-w-0">
          <div class="scroll-content-container relative z-10 flex-1 min-h-0">
            <div class="max-w-[900px] mx-auto px-8 py-16 min-w-0">
              <article class="markdown-content bg-black prose prose-invert max-w-none">
                <div v-html="htmlContent"></div>
              </article>

              <footer class="mt-24 pt-12 border-t border-white/[0.05] grid grid-cols-2 gap-8">
                <div v-if="getNavigationPages(activeSection).previous">
                  <button
                      @click="navigateToPage(getNavigationPages(activeSection).previous!.id)"
                      class="w-full p-6 rounded-2xl cursor-pointer bg-white/[0.08] border border-white/[0.05] hover:border-white/20 transition-all text-left group"
                  >
                    <span class="text-xs text-zinc-600 flex items-center gap-2 mb-2"><ChevronLeft :size="14" /> Previous</span>
                    <div class="text-zinc-400 font-bold group-hover:text-white transition-colors">{{ getNavigationPages(activeSection).previous!.label }}</div>
                  </button>
                </div>
                <div v-else></div>

                <div v-if="getNavigationPages(activeSection).next">
                  <button
                      @click="navigateToPage(getNavigationPages(activeSection).next!.id)"
                      class="w-full p-6 rounded-2xl cursor-pointer bg-white/[0.08] border border-white/[0.05] hover:border-white/20 transition-all text-right group"
                  >
                    <span class="text-xs text-zinc-600 flex items-center justify-end gap-2 mb-2">Next <ChevronRight :size="14" /></span>
                    <div class="text-zinc-400 font-bold group-hover:text-white transition-colors">{{ getNavigationPages(activeSection).next!.label }}</div>
                  </button>
                </div>
                <div v-else></div>
              </footer>
            </div>
          </div>
        </div>
      </main>

      <aside class="z-20 w-72 min-w-72 max-w-72 h-[calc(100vh-8rem)] mb-6 mr-6 sticky top-24 self-start hidden xl:flex flex-col flex-none bg-black backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl">
        <div class="h-full p-8 overflow-y-auto custom-scrollbar">
          <div class="space-y-8">
            <div>
              <h4 class="text-[10px] font-bold text-zinc-200 uppercase tracking-widest mb-6 border-l-2 pl-4 border-zinc-700">On this page</h4>
              <div class="space-y-4">
                <a
                    v-for="(h, i) in headings"
                    :key="i"
                    :href="`#${h.id}`"
                    :class="`block text-sm transition-colors hover:text-white ${h.level > 1 ? 'ml-4 text-zinc-600' : 'text-zinc-500 font-medium'}`"
                >
                  {{ h.text }}
                </a>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <Footer />
  </div>
</template>

<style>
/* CSS Extra caso o tema do Prism precise de ajustes finos */
/* Remove o background padrão do tema para usar o seu bg-transparent do componente */
pre[class*="language-"] {
  background: transparent !important;
  text-shadow: none !important;
}

/* Garante que o scroll funcione bem dentro do bloco de código */
.code-block pre {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
}
</style>
<script lang="ts">
import {Metadata} from "vatts/vue";

export function generateMetadata(params: any): Metadata {
  const isFrameworkParam = params?.value2 === 'react' || params?.value2 === 'vue';
  const pageId = isFrameworkParam ? (params?.value3 || 'introduction') : (params?.value2 || 'introduction');

  const currentItem = sidebarConfig.sections.flatMap(s => s.items).find(i => i.id === pageId);
  return {
    title: `Vatts.js | Docs - ${currentItem?.label || 'Documentation'}`
  }
}
</script>
