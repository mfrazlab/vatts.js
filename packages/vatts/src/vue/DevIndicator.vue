<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

// Definição das props
const props = defineProps({
  hasBuildError: {
    type: Boolean,
    default: false
  }
});

// Eventos
// Em vez de passar uma função callback como prop (React), emitimos um evento no Vue.
const emit = defineEmits(['click-build-error']);

const isVisible = ref(true);
const hotState = ref('idle');
const mounted = ref(false);

const isReloading = computed(() => hotState.value === 'reloading');
const isError = computed(() => !!props.hasBuildError);

const handleBadgeClick = () => {
  if (isError.value) {
    emit('click-build-error');
  }
};

onMounted(() => {
  mounted.value = true;

  const handler = (ev) => {
    const detail = ev?.detail;
    if (!detail || !detail.state) return;

    if (detail.state === 'reloading' || detail.state === 'full-reload') {
      hotState.value = 'reloading';
    }
    if (detail.state === 'idle') {
      hotState.value = 'idle';
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('vatts:hotreload', handler);
  }

  onUnmounted(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('vatts:hotreload', handler);
    }
  });
});
</script>

<template>
  <Teleport to="body">
    <div
        v-if="isVisible && mounted"
        class="vatts-dev-badge"
        :class="{ 'clickable': isError }"
        @click="handleBadgeClick"
    >
      <!-- Loading Spinner ou Status Dot -->
      <div v-if="isReloading" class="vatts-spinner"></div>
      <div
          v-else
          class="vatts-status-dot"
          :class="{ 'reloading': isReloading, 'error': isError }"
      ></div>

      <!-- Logo & Texto -->
      <div class="vatts-logo">
        VATTS<span>.JS</span>
        <span v-if="isError" class="vatts-error-pill">ERROR</span>
      </div>

      <!-- Botão Fechar -->
      <button
          class="close-btn"
          @click.stop="isVisible = false"
          aria-label="Close badge"
      >
        ×
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
/* Importando fonte (opcional se já existir globalmente, mas mantendo consistência com o original) */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap');

@keyframes vatts-pulse {
  0% { opacity: 0.4; }
  50% { opacity: 1; }
  100% { opacity: 0.4; }
}

@keyframes vatts-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.vatts-dev-badge {
  position: fixed;
  bottom: 20px;
  right: 20px;
  /* Z-index alto para ficar acima de tudo */
  z-index: 2147483647;

  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);

  border-radius: 10px;
  color: #fff;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;

  /* Estilo Monocromático Next.js */
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  transition: all 0.2s ease;
  cursor: default;
  user-select: none;
}

.vatts-dev-badge.clickable {
  cursor: pointer;
}

.vatts-dev-badge:hover {
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
  background: rgba(10, 10, 10, 0.95);
}

.vatts-status-dot {
  width: 7px;
  height: 7px;
  background: #ffffff; /* Branco para status OK */
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
  animation: vatts-pulse 2.5s infinite ease-in-out;
}

.vatts-status-dot.reloading {
  background: #64748b; /* Slate */
  box-shadow: none;
}

.vatts-status-dot.error {
  background: #ef4444; /* Vermelho para erro */
  box-shadow: 0 0 10px #ef4444;
  animation: vatts-pulse 1s infinite ease-in-out;
}

.vatts-spinner {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.1);
  border-top-color: #ffffff;
  animation: vatts-spin 0.8s linear infinite;
}

.vatts-logo {
  color: #ffffff;
  font-weight: 800;
  display: flex;
  align-items: center;
}

.vatts-logo span {
  color: #64748b;
}

.vatts-error-pill {
  margin-left: 8px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #ffffff;
  color: #000000;
  font-size: 9px;
  font-weight: 900;
}

.close-btn {
  background: none;
  border: none;
  color: rgba(255,255,255,0.2);
  cursor: pointer;
  font-size: 16px;
  padding: 0 0 0 4px;
  margin-left: 4px;
  display: flex;
  align-items: center;
}

.close-btn:hover {
  color: rgba(255,255,255,0.6);
}
</style>