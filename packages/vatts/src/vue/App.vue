<!--
  This file is part of the Vatts.js Project.
  Copyright (c) 2026 mfraz

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
-->
<template>
  <component :is="resolvedLayout" v-if="resolvedLayout">
    <component
        :is="resolvedContent"
        v-bind="contentProps"
        :key="`page-${hmrTimestamp}-${currentPathKey}`"
    />
  </component>

  <component
      v-else
      :is="resolvedContent"
      v-bind="contentProps"
      :key="`page-${hmrTimestamp}-${currentPathKey}`"
  />

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
  initialParams: null,
  layoutComponent: null
});

// --- Estado ---
const hmrTimestamp = ref(Date.now());
const currentPathKey = ref(window.location.pathname); // Mantendo a correção da rota anterior

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

  // Atualiza a chave para garantir re-render na mesma rota com params diferentes
  currentPathKey.value = currentPath;

  const match = findRouteForPath(currentPath);
  if (match) {
    CurrentPageComponent.value = props.componentMap[match.componentPath];
    console.log(props.componentMap[match.componentPath] || 'null')
    params.value = match.params;

    if (match.metadata?.title != null) {
      document.title = match.metadata.title;
    }
  } else {
    CurrentPageComponent.value = null;
    params.value = {};
  }
};

// --- Computed ---
const resolvedContent = computed(() => {
  if (!CurrentPageComponent.value || props.initialComponentPath === '__404__') {
    const NotFoundComponent = window.__VATTS_NOT_FOUND__;
    if (NotFoundComponent) return NotFoundComponent;

    const DefaultNotFound = window.__VATTS_DEFAULT_NOT_FOUND__;
    return DefaultNotFound || 'div';
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

// --- Lifecycle ---
onMounted(() => {
  updateRoute();

  window.addEventListener('vatts:build-error', handleBuildError);
  window.addEventListener('vatts:build-ok', handleBuildOk);
  window.addEventListener('popstate', updateRoute);

  const unsubscribeRouter = router.subscribe(updateRoute);

  window.__HWEB_HMR__ = true;
  const handleHMRUpdate = (event) => {
    const { file, timestamp } = event.detail;
    try {
      hmrTimestamp.value = timestamp;
      window.__HMR_SUCCESS__ = true;
      setTimeout(() => { window.__HMR_SUCCESS__ = false; }, 3000);
      updateRoute();
    } catch (error) {
      console.error('❌ HMR Error:', error);
    }
  };
  window.addEventListener('hmr:component-update', handleHMRUpdate);

  onUnmounted(() => {
    window.removeEventListener('vatts:build-error', handleBuildError);
    window.removeEventListener('vatts:build-ok', handleBuildOk);
    window.removeEventListener('popstate', updateRoute);
    window.removeEventListener('hmr:component-update', handleHMRUpdate);
    unsubscribeRouter();
  });
});
</script>