<template>
  <div class="vatts-ssr-error">
    <div class="container">
      <h1>{{ titleComputed }}</h1>

      <p v-if="requestUrl" class="muted">
        URL:
        <code>{{ requestUrl }}</code>
      </p>

      <p v-if="hint" class="muted">{{ hint }}</p>

      <div class="panel">
        <div class="label">Mensagem</div>
        <pre class="pre">{{ message }}</pre>

        <template v-if="stack">
          <div class="label" style="margin-top: 16px">Stack</div>
          <pre class="pre stack">{{ stack }}</pre>
        </template>
      </div>

      <p class="footer">
        Dica: em desenvolvimento isso aparece para debugar. Em produção o SSR falha de forma silenciosa e o cliente assume
        a renderização.
      </p>
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
const titleComputed = computed(() => props.title || 'Erro no Server-Side Renderer');
const message = computed(() => formatted.value.message);
const stack = computed(() => formatted.value.stack);
const hint = computed(() => props.hint);
const requestUrl = computed(() => props.requestUrl);
</script>

<style scoped>
.vatts-ssr-error {
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji,
    Segoe UI Emoji;
  padding: 24px;
  color: #0f172a;
  background: #ffffff;
}
.container {
  max-width: 980px;
  margin: 0 auto;
}
h1 {
  font-size: 20px;
  margin: 0;
}
.muted {
  margin-top: 8px;
  margin-bottom: 0;
  color: #334155;
}
code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.panel {
  margin-top: 16px;
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
}
.label {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 8px;
}
.pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
}
.pre.stack {
  font-size: 12px;
  color: #334155;
}
.footer {
  margin-top: 16px;
  color: #475569;
  font-size: 13px;
}
</style>
