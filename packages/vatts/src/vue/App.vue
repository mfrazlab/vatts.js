<template>
  <div>
    <!-- Renderiza o Layout se existir, envolvendo o conteúdo -->
    <component :is="resolvedLayout" v-if="resolvedLayout">
      <component :is="resolvedContent" v-bind="contentProps" :key="`page-${hmrTimestamp}`" />
    </component>

    <!-- Se não tiver layout, renderiza o conteúdo direto -->
    <component v-else :is="resolvedContent" v-bind="contentProps" :key="`page-${hmrTimestamp}`" />

    <!-- Dev Tools / Indicadores -->
    <DevIndicator
        v-if="isDev"
        :has-build-error="!!buildError"
        @click-build-error="isErrorOpen = true"
    />

    <ErrorModal
        :error="buildError"
        :is-open="isErrorOpen"
        @close="isErrorOpen = false"
        @copy="copyBuildError"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, shallowRef, watch, nextTick } from 'vue';
import { router } from '../client/clientRouter'; // Assumindo que o router é framework-agnostic
import DevIndicator from './DevIndicator.vue'; // .vue necessário
import ErrorModal from './ErrorModal.vue'; // Se for .vue, ajustar import
import type { VattsBuildError } from './ErrorModal.vue';
import type { Metadata } from "../types";

// --- Props (Vêm do entry.client.ts) ---
const props = defineProps<{
  componentMap: Record<string, any>;
  routes: { pattern: string; componentPath: string; metadata?: Metadata }[];
  initialComponentPath: string;
  initialParams: any;
  layoutComponent?: any;
}>();

// --- Estado ---
const hmrTimestamp = ref(Date.now());
const buildError = ref<VattsBuildError | null>((window as any).__VATTS_BUILD_ERROR__ || null);
const isErrorOpen = ref(!!(window as any).__VATTS_BUILD_ERROR__);
const isDev = process.env.NODE_ENV !== 'production';

// --- HMR & Error Handling ---
const handleBuildError = (ev: any) => {
  const e = ev?.detail as VattsBuildError;
  buildError.value = e || null;
  isErrorOpen.value = true;
};

const handleBuildOk = () => {
  buildError.value = null;
  isErrorOpen.value = false;
};

const copyBuildError = async () => {
  try {
    if (!buildError.value) return;
    const payload = JSON.stringify(buildError.value, null, 2);
    await navigator.clipboard.writeText(payload);
  } catch {
    // ignore
  }
};

// --- Roteamento ---
const findRouteForPath = (path: string) => {
  for (const route of props.routes) {
    const regexPattern = route.pattern
        .replace(/\[\[\.\.\.(\w+)\]\]/g, '(?<$1>.+)?')
        .replace(/\[\.\.\.(\w+)\]/g, '(?<$1>.+)')
        .replace(/\/\[\[(\w+)\]\]/g, '(?:/(?<$1>[^/]+))?')
        .replace(/\[\[(\w+)\]\]/g, '(?<$1>[^/]+)?')
        .replace(/\[(\w+)\]/g, '(?<$1>[^/]+)');
    const regex = new RegExp(`^${regexPattern}/?$`);
    const match = path.match(regex);
    if (match) {
      return {
        componentPath: route.componentPath,
        params: match.groups || {},
        metadata: route.metadata
      };
    }
  }
  return null;
};

// Estado da Rota
// shallowRef é melhor para componentes para evitar reatividade profunda desnecessária no objeto do componente
const CurrentPageComponent = shallowRef<any>(null);
const params = ref<any>({});

const updateRoute = () => {
  const currentPath = window.location.pathname.replace("index.html", '');
  const match = findRouteForPath(currentPath);

  if (match) {
    CurrentPageComponent.value = props.componentMap[match.componentPath];
    params.value = match.params;

    if (match.metadata?.title != null) {
      document.title = match.metadata.title;
    }
  } else {
    CurrentPageComponent.value = null;
    params.value = {};
  }
};

// --- Computed para resolver o conteúdo final (404 vs Página) ---
const resolvedContent = computed(() => {
  if (!CurrentPageComponent.value || props.initialComponentPath === '__404__') {
    const NotFoundComponent = (window as any).__VATTS_NOT_FOUND__;
    if (NotFoundComponent) return NotFoundComponent;

    const DefaultNotFound = (window as any).__VATTS_DEFAULT_NOT_FOUND__;
    return DefaultNotFound || 'div'; // Fallback seguro
  }
  return CurrentPageComponent.value;
});

const contentProps = computed(() => {
  // Se for 404, talvez não queira passar params, mas mantendo a lógica original:
  if (!CurrentPageComponent.value) return {};
  return { params: params.value };
});

const resolvedLayout = computed(() => {
  return props.layoutComponent || null;
});

// --- Lifecycle & Listeners ---
onMounted(() => {
  // Inicializa rota
  updateRoute();

  // Listeners de Build
  window.addEventListener('vatts:build-error' as any, handleBuildError);
  window.addEventListener('vatts:build-ok' as any, handleBuildOk);

  // Listeners de Rota
  window.addEventListener('popstate', updateRoute);
  const unsubscribeRouter = router.subscribe(updateRoute);

  // HMR Listener
  (window as any).__HWEB_HMR__ = true;
  const handleHMRUpdate = (event: CustomEvent) => {
    const { file, timestamp } = event.detail;
    const fileName = file ? file.split('/').pop()?.split('\\').pop() : 'unknown';
    console.log('🔥 HMR: Component Update Triggered', fileName);

    try {
      hmrTimestamp.value = timestamp;
      (window as any).__HMR_SUCCESS__ = true;
      setTimeout(() => {
        (window as any).__HMR_SUCCESS__ = false;
      }, 3000);

      // Força update da rota caso o componente tenha mudado
      updateRoute();
    } catch (error) {
      console.error('❌ HMR Error:', error);
      (window as any).__HMR_SUCCESS__ = false;
    }
  };
  window.addEventListener('hmr:component-update' as any, handleHMRUpdate);

  // Cleanup
  onUnmounted(() => {
    window.removeEventListener('vatts:build-error' as any, handleBuildError);
    window.removeEventListener('vatts:build-ok' as any, handleBuildOk);
    window.removeEventListener('popstate', updateRoute);
    window.removeEventListener('hmr:component-update' as any, handleHMRUpdate);
    unsubscribeRouter();
  });
});
</script>