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

<script setup>
import { ref, computed, onMounted, onUnmounted, shallowRef, watch, nextTick } from 'vue';
import { router } from '../client/clientRouter';
import DevIndicator from './DevIndicator.vue';
import ErrorModal from './ErrorModal.vue';

// --- Props ---
const props = defineProps({
  componentMap: Object,
  routes: Array,
  initialComponentPath: String,
  initialParams: null, // Aceita qualquer tipo
  layoutComponent: null // Aceita componente ou null
});

// --- Estado ---
const hmrTimestamp = ref(Date.now());
// Removemos as tipagens e asserções "as any" diretas onde não são necessárias em JS
const buildError = ref(window.__VATTS_BUILD_ERROR__ || null);
const isErrorOpen = ref(!!window.__VATTS_BUILD_ERROR__);
const isDev = process.env.NODE_ENV !== 'production';

// --- HMR & Error Handling ---
const handleBuildError = (ev) => {
  const e = ev?.detail;
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
const findRouteForPath = (path) => {
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
const CurrentPageComponent = shallowRef(null);
const params = ref({});

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
    const NotFoundComponent = window.__VATTS_NOT_FOUND__;
    if (NotFoundComponent) return NotFoundComponent;

    const DefaultNotFound = window.__VATTS_DEFAULT_NOT_FOUND__;
    return DefaultNotFound || 'div'; // Fallback seguro
  }
  return CurrentPageComponent.value;
});

const contentProps = computed(() => {
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
  window.addEventListener('vatts:build-error', handleBuildError);
  window.addEventListener('vatts:build-ok', handleBuildOk);

  // Listeners de Rota
  window.addEventListener('popstate', updateRoute);
  const unsubscribeRouter = router.subscribe(updateRoute);

  // HMR Listener
  window.__HWEB_HMR__ = true;
  const handleHMRUpdate = (event) => {
    const { file, timestamp } = event.detail;
    const fileName = file ? file.split('/').pop()?.split('\\').pop() : 'unknown';
    console.log('🔥 HMR: Component Update Triggered', fileName);

    try {
      hmrTimestamp.value = timestamp;
      window.__HMR_SUCCESS__ = true;
      setTimeout(() => {
        window.__HMR_SUCCESS__ = false;
      }, 3000);

      // Força update da rota caso o componente tenha mudado
      updateRoute();
    } catch (error) {
      console.error('❌ HMR Error:', error);
      window.__HMR_SUCCESS__ = false;
    }
  };
  window.addEventListener('hmr:component-update', handleHMRUpdate);

  // Cleanup
  onUnmounted(() => {
    window.removeEventListener('vatts:build-error', handleBuildError);
    window.removeEventListener('vatts:build-ok', handleBuildOk);
    window.removeEventListener('popstate', updateRoute);
    window.removeEventListener('hmr:component-update', handleHMRUpdate);
    unsubscribeRouter();
  });
});
</script>