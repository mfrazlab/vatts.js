<template>
  <Teleport to="body">
    <!-- Overlay -->
    <div v-if="shouldRender" :style="overlayStyle" @mousedown="close">
      <!-- Modal Card -->
      <div :style="cardStyle" @mousedown.stop>

        <!-- Neon Line -->
        <div :style="neonLineStyle"></div>

        <!-- Header -->
        <div :style="headerStyle">
          <div style="display: flex; align-items: center; gap: 12px">
            <span :style="errorBadgeStyle">ERROR</span>
            <span v-if="error?.plugin" :style="pluginBadgeStyle">{{ error.plugin }}</span>
          </div>

          <div style="display: flex; gap: 8px">
            <button
                v-if="hasCopyListener"
                @click="copy"
                @mouseenter="isHoveringCopy = true"
                @mouseleave="isHoveringCopy = false"
                :style="copyButtonStyle"
            >
              Copy Log
            </button>
            <button
                @click="close"
                @mouseenter="isHoveringClose = true"
                @mouseleave="isHoveringClose = false"
                :style="closeButtonStyle"
            >
              Close
            </button>
          </div>
        </div>

        <!-- Terminal Content -->
        <div :style="terminalContentStyle">
           <span v-for="(part, i) in parsedMessage" :key="'msg-'+i" :style="{ color: part.color || 'inherit' }">
             {{ part.text }}
           </span>
          <div v-if="parsedStack.length" :style="stackContainerStyle">
              <span v-for="(part, i) in parsedStack" :key="'stack-'+i" :style="{ color: part.color || 'inherit' }">
                {{ part.text }}
              </span>
          </div>
        </div>

        <!-- Footer -->
        <div :style="footerStyle">
          <span>vatts-cli</span>
          <span style="color: #64748b; fontWeight: 500">Watching for changes...</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, useAttrs } from 'vue';

// --- Interface Exportada para uso no App.vue ---
export interface VattsBuildError {
  message?: string;
  name?: string;
  stack?: string;
  frame?: string;
  id?: string;
  plugin?: string;
  pluginCode?: string;
  loc?: any;
  watchFiles?: any;
  cause?: any;
  ts?: number;
}

// --- Props e Emits ---
const props = defineProps<{
  error: VattsBuildError | null;
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'copy'): void;
}>();

// Verifica se o pai (App.vue) passou um listener para @copy
const attrs = useAttrs();
const hasCopyListener = computed(() => !!attrs.onCopy);

// --- Estado ---
const visible = ref(false);
const shouldRender = ref(false); // Controla a montagem/desmontagem do DOM
const isHoveringClose = ref(false);
const isHoveringCopy = ref(false);

// --- Lógica de Parser ANSI ---
const ANSI_COLORS: Record<string, string> = {
  '30': '#475569',
  '31': '#ef4444',
  '32': '#ffffff',
  '33': '#94a3b8',
  '34': '#cbd5e1',
  '35': '#e2e8f0',
  '36': '#ffffff',
  '37': '#ffffff',
  '90': '#64748b',
};

function parseAnsi(text: string) {
  if (!text) return [];
  const regex = /\u001b\[(\d+)(?:;\d+)*m/g;
  const result = [];
  let lastIndex = 0;
  let match;
  let currentColor: string | null = null;

  while ((match = regex.exec(text)) !== null) {
    const rawText = text.slice(lastIndex, match.index);
    if (rawText) {
      result.push({ text: rawText, color: currentColor });
    }

    const code = match[1];
    if (code === '39' || code === '0') {
      currentColor = null;
    } else if (ANSI_COLORS[code]) {
      currentColor = ANSI_COLORS[code];
    }

    lastIndex = regex.lastIndex;
  }

  const remaining = text.slice(lastIndex);
  if (remaining) {
    result.push({ text: remaining, color: currentColor });
  }

  return result;
}

const parsedMessage = computed(() => parseAnsi(props.error?.message || ''));
const parsedStack = computed(() => {
  if (!props.error?.stack) return [];
  return parseAnsi(`\n\nStack Trace:\n${props.error.stack}`);
});

// --- Lifecycle e Watchers (Animações) ---
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    document.body.style.overflow = 'hidden';
    shouldRender.value = true;
    // Pequeno delay para garantir que o elemento exista antes da transição de opacidade
    setTimeout(() => { visible.value = true; }, 10);
  } else {
    document.body.style.overflow = '';
    visible.value = false;
    // Aguarda a transição de saída (300ms) para desmontar do DOM
    setTimeout(() => { shouldRender.value = false; }, 300);
  }
}, { immediate: true });

// Listener para tecla ESC
const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.isOpen) emit('close');
};

onMounted(() => {
  if (props.isOpen) document.body.style.overflow = 'hidden';
  window.addEventListener('keydown', onKey);
});

onUnmounted(() => {
  document.body.style.overflow = '';
  window.removeEventListener('keydown', onKey);
});

// --- Ações ---
const close = () => emit('close');
const copy = () => emit('copy');

// --- Estilos (Convertidos para objetos JS para Vue bind) ---
const overlayStyle = computed(() => ({
  position: 'fixed' as const,
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  zIndex: 2147483647,
  background: visible.value ? 'rgba(0, 0, 0, 0.95)' : 'rgba(0, 0, 0, 0)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  transition: 'all 0.3s ease',
  opacity: visible.value ? 1 : 0,
  boxSizing: 'border-box' as const,
}));

const cardStyle = computed(() => ({
  width: '100%',
  maxWidth: '1080px',
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column' as const,
  background: '#0a0a0a',
  boxShadow: `0 0 0 1px rgba(255, 255, 255, 0.1), 0 50px 100px -20px rgba(0, 0, 0, 1)`,
  borderRadius: '16px',
  overflow: 'hidden',
  transform: visible.value ? 'scale(1) translateY(0)' : 'scale(0.98) translateY(10px)',
  transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
  position: 'relative' as const,
}));

const neonLineStyle = {
  height: '1px',
  width: '100%',
  background: `linear-gradient(90deg, transparent, #334155, #ffffff, #334155, transparent)`,
  boxShadow: `0 0 15px rgba(255, 255, 255, 0.05)`,
};

const headerStyle = {
  padding: '16px 24px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  background: 'rgba(255,255,255,0.01)'
};

const errorBadgeStyle = {
  fontSize: '11px',
  fontWeight: 900,
  color: '#ffffff',
  background: '#ef4444',
  padding: '2px 8px',
  borderRadius: '4px',
  letterSpacing: '0.05em'
};

const pluginBadgeStyle = {
  fontSize: '11px',
  color: '#64748b',
  background: 'rgba(255, 255, 255, 0.03)',
  padding: '2px 8px',
  borderRadius: '4px',
  fontFamily: 'monospace',
  border: '1px solid rgba(255, 255, 255, 0.05)'
};

const terminalContentStyle = {
  padding: '24px',
  overflow: 'auto',
  flex: 1,
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: '13px',
  lineHeight: 1.6,
  color: '#e2e8f0',
  whiteSpace: 'pre-wrap' as const,
  wordBreak: 'break-word' as const,
};

const stackContainerStyle = {
  marginTop: '24px',
  opacity: 0.4,
  borderTop: '1px dashed rgba(255,255,255,0.1)',
  paddingTop: '16px'
};

const footerStyle = {
  padding: '10px 24px',
  background: 'rgba(255,255,255,0.01)',
  borderTop: '1px solid rgba(255,255,255,0.03)',
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '11px',
  color: 'rgba(255,255,255,0.3)',
  fontFamily: 'Inter, sans-serif'
};

const getBtnStyle = (kind: 'primary' | 'secondary', hovering: boolean) => {
  const base = {
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    border: 'none',
    outline: 'none',
    fontFamily: 'Inter, system-ui, sans-serif'
  };
  if (kind === 'primary') {
    return {
      ...base,
      background: hovering ? '#ffffff' : '#f1f5f9',
      color: '#000000',
      boxShadow: hovering ? `0 0 15px rgba(255, 255, 255, 0.2)` : 'none',
    };
  }
  return {
    ...base,
    background: hovering ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
    color: hovering ? '#fff' : 'rgba(255, 255, 255, 0.4)',
    border: '1px solid transparent',
    borderColor: hovering ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
  };
};

const copyButtonStyle = computed(() => getBtnStyle('secondary', isHoveringCopy.value));
const closeButtonStyle = computed(() => getBtnStyle('primary', isHoveringClose.value));
</script>