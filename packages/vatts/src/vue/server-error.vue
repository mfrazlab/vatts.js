<template>
  <div class="ssr-error-wrapper">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

    <div class="container">
      <div class="card">
        <div class="neon-line"></div>

        <div class="content">
          <h1>
            {{ titleComputed }}
          </h1>

          <div class="meta-info" v-if="requestUrl || hint">
            <div v-if="requestUrl" class="meta-row">
              <span class="meta-label">REQUEST URL:</span>
              <code class="meta-value">{{ requestUrl }}</code>
            </div>
            <div v-if="hint" class="meta-row">
              <span class="meta-label">HINT:</span>
              <span class="meta-value accent">{{ hint }}</span>
            </div>
          </div>

          <div class="terminal-box">
            <div class="terminal-header">
              <div class="dots">
                <div class="dot red"></div>
                <div class="dot yellow"></div>
                <div class="dot green"></div>
              </div>
              <span class="terminal-title">SSR Exception Log</span>
            </div>

            <div class="terminal-body custom-scroll">
              <div class="log-entry error">
                <span class="arrow">></span> {{ message }}
              </div>

              <template v-if="stack">
                <div class="separator"></div>
                <div class="stack-trace">
                  {{ stack }}
                </div>
              </template>
            </div>
          </div>
        </div>

        <div class="card-footer">
          <div class="status-error">
            <div class="status-dot"></div>
            <span>Render Failed</span>
          </div>
        </div>
      </div>
      
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  title?: string;
  error?: unknown;
  hint?: string;
  requestUrl?: string;
}>();

function formatUnknownError(error: unknown): { message: string; stack?: string } {
  if (!error) return { message: 'Erro desconhecido no SSR.' };

  if (error instanceof Error) {
    return { message: error.message || String(error), stack: error.stack };
  }

  if (typeof error === 'string') {
    return { message: error };
  }

  try {
    return { message: JSON.stringify(error, null, 2) };
  } catch {
    return { message: String(error) };
  }
}

const formatted = computed(() => formatUnknownError(props.error));
const titleComputed = computed(() => props.title || 'SSR Error');
const message = computed(() => formatted.value.message);
const stack = computed(() => formatted.value.stack);
const hint = computed(() => props.hint);
const requestUrl = computed(() => props.requestUrl);
</script>

<style scoped>
.ssr-error-wrapper {
  /* Reset e Variáveis baseadas no Vatts.js Theme */
  --vue-green: #42b883;
  --vue-dark: #35495e;
  --bg-solid: #000000;
  --card-bg: #0a0a0a;
  --text-main: #ffffff;
  --text-muted: #a7c4bc;
  --error-red: #ff5f56;

  font-family: 'Inter', system-ui, sans-serif;
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: var(--bg-solid);
  color: var(--text-main);
  overflow: hidden;
  z-index: 9999;
  box-sizing: border-box;
}

.container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  padding: 20px;
}

.card {
  width: 100%;
  max-width: 900px; /* Mais largo para caber stack trace */
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: var(--card-bg);
  box-shadow: 0 0 0 1px rgba(66, 184, 131, 0.1), 0 40px 80px -20px rgba(0, 0, 0, 0.9);
  border-radius: 20px;
  overflow: hidden;
  position: relative;
}

/* Efeito Neon Superior */
.neon-line {
  height: 1px;
  width: 100%;
  background: linear-gradient(90deg, transparent, var(--vue-dark), var(--vue-green), var(--vue-dark), transparent);
  box-shadow: 0 0 15px rgba(66, 184, 131, 0.2);
  flex-shrink: 0;
}

.content {
  padding: 32px 40px;
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden; /* Para o scroll ficar apenas no terminal se necessário */
}

h1 {
  margin: 0 0 24px 0;
  font-size: 1.8rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  background: linear-gradient(180deg, #ffffff 0%, var(--vue-green) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  display: flex;
  align-items: center;
  gap: 12px;
}

.icon {
  -webkit-text-fill-color: initial;
  font-size: 1.5rem;
}

/* Área de Metadados */
.meta-info {
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.meta-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 0.9rem;
}

.meta-label {
  color: var(--vue-dark);
  font-weight: 700;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
}

.meta-value {
  color: var(--text-muted);
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.85rem;
  word-break: break-all;
}

.meta-value.accent {
  color: var(--vue-green);
}

/* Terminal Styles */
.terminal-box {
  background: rgba(10, 10, 10, 0.8);
  border: 1px solid rgba(66, 184, 131, 0.15);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  font-family: 'JetBrains Mono', monospace;
}

.terminal-header {
  background: rgba(66, 184, 131, 0.05);
  padding: 12px 16px;
  border-bottom: 1px solid rgba(66, 184, 131, 0.1);
  display: flex;
  align-items: center;
  gap: 12px;
}

.dots {
  display: flex;
  gap: 6px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.dot.red { background: #ff5f56; }
.dot.yellow { background: #ffbd2e; }
.dot.green { background: #27c93f; }

.terminal-title {
  font-size: 0.75rem;
  color: rgba(255,255,255,0.3);
}

.terminal-body {
  padding: 20px;
  overflow-y: auto;
  color: #e0e0e0;
  font-size: 0.85rem;
  line-height: 1.6;
}

.log-entry.error {
  color: #ff8b8b; /* Vermelho claro para erro */
  font-weight: 600;
  margin-bottom: 16px;
}

.arrow {
  color: var(--vue-dark);
  margin-right: 8px;
}

.separator {
  height: 1px;
  background: rgba(255,255,255,0.1);
  margin: 16px 0;
  width: 100%;
}

.stack-trace {
  color: rgba(167, 196, 188, 0.6); /* Muted green */
  white-space: pre-wrap;
  font-size: 0.75rem;
  line-height: 1.5;
}

/* Custom Scrollbar for Terminal */
.custom-scroll::-webkit-scrollbar {
  width: 8px;
}
.custom-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scroll::-webkit-scrollbar-thumb {
  background: rgba(66, 184, 131, 0.2);
  border-radius: 4px;
}
.custom-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(66, 184, 131, 0.4);
}

/* Footer do Card */
.card-footer {
  padding: 16px 40px;
  background: rgba(66, 184, 131, 0.02);
  border-top: 1px solid rgba(66, 184, 131, 0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  box-sizing: border-box;
}

.footer-hint {
  color: rgba(255, 255, 255, 0.3);
}

.status-error {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--error-red);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.status-dot {
  width: 6px;
  height: 6px;
  background-color: var(--error-red);
  border-radius: 50%;
  box-shadow: 0 0 8px var(--error-red);
}

/* Branding fora do card */
.brand-link {
  margin-top: 24px;
  opacity: 0.4;
}

.brand-text {
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.brand-highlight {
  color: var(--vue-green);
}
</style>