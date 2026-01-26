<script setup>
import { ref, onMounted } from 'vue';

const path = ref('/');

onMounted(() => {
  if (typeof window !== 'undefined') {
    path.value = window.location.pathname;
  }
});

const reload = () => {
  window.location.reload();
};
</script>

<template>
  <div class="error-page-wrapper">
    <!-- Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

    <div class="container">
      <div class="card">
        <div class="neon-line"></div>

        <div class="content">
          <div class="code">404</div>

          <div class="terminal-box">
            <div class="terminal-dots">
              <div class="dot"></div>
              <div class="dot"></div>
              <div class="dot"></div>
            </div>
            <div>
              <span class="method">GET</span>
              <span class="path">{{ path }}</span>
            </div>
            <div class="error-msg">
              <span>Error: Route not found</span>
            </div>
          </div>

          <div class="actions">
            <a href="/" class="btn btn-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Back Home
            </a>
            <button @click="reload" class="btn btn-secondary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 2v6h-6"></path>
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
                <path d="M3 22v-6h6"></path>
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
              </svg>
              Retry
            </button>
          </div>
        </div>

        <div class="footer">
          <span>Vatts Server</span>
          <div class="status">
            <div class="status-dot"></div>
            <span class="status-text">Not Found</span>
          </div>
        </div>
      </div>

      <a href="https://npmjs.com/package/vatts" target="_blank" rel="noopener noreferrer" class="brand-link">
        <img src="https://raw.githubusercontent.com/mfrazlab/vatts.js/master/docs/public/logo.png" alt="Vatts Logo" class="brand-logo" />
        <span class="brand-text">
            Vatts<span class="brand-highlight">.js</span>
        </span>
      </a>
    </div>
  </div>
</template>

<style scoped>
/* Reset global local e variáveis */
.error-page-wrapper {
  font-family: 'Inter', system-ui, sans-serif;
  box-sizing: border-box;
}

/* Em componentes Vue, estilos 'scoped' aplicam-se apenas a este componente.
  Para garantir o fundo preto total, usamos :global(body) ou aplicamos ao container fixo.
*/
:global(body) {
  margin: 0;
  padding: 0;
  background-color: #000000;
  color: #ffffff;
  overflow: hidden;
  height: 100vh;
  width: 100vw;
}

.container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100vw;
  height: 100vh;
  background: #000000;
}

.card {
  width: min(90%, 500px);
  display: flex;
  flex-direction: column;
  background: #0a0a0a;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1), 0 40px 80px -20px rgba(0, 0, 0, 0.9);
  border-radius: 20px;
  overflow: hidden;
  position: relative;
}

.neon-line {
  height: 1px;
  width: 100%;
  background: linear-gradient(90deg, transparent, #334155, #ffffff, #334155, transparent);
  box-shadow: 0 0 15px rgba(255, 255, 255, 0.1);
}

.content {
  padding: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.code {
  font-size: 80px;
  font-weight: 900;
  line-height: 1;
  letter-spacing: -0.04em;
  color: #fff;
  background: linear-gradient(180deg, #ffffff 0%, #475569 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  /* Fallback */
  color: #ffffff;
  margin-bottom: 16px;
  filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.05));
}

.terminal-box {
  width: 100%;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
  text-align: left;
  color: #94a3b8;
  box-sizing: border-box;
}

.terminal-dots {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
  opacity: 0.3;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #fff;
}

.method {
  color: #64748b;
  margin-right: 4px;
}

.path {
  color: #fff;
}

.error-msg {
  margin-top: 4px;
  color: #475569;
}

.actions {
  display: flex;
  gap: 12px;
  width: 100%;
}

.btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  outline: none;
  text-decoration: none;
  font-family: 'Inter', sans-serif;
  flex: 1;
  justify-content: center;
}

.btn-primary {
  background: #f8fafc;
  color: #000000;
}

.btn-primary:hover {
  background: #ffffff;
  box-shadow: 0 0 20px rgba(255, 255, 255, 0.2);
}

.btn-secondary {
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.3);
}

.footer {
  padding: 12px 32px;
  background: rgba(255, 255, 255, 0.02);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
  box-sizing: border-box;
}

.status {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #475569;
}

.status-text {
  color: #94a3b8;
}

.brand-link {
  margin-top: 32px;
  display: flex;
  align-items: center;
  gap: 10px;
  opacity: 0.4;
  transition: opacity 0.3s;
  text-decoration: none;
  color: #fff;
}

.brand-link:hover {
  opacity: 1;
}

.brand-logo {
  width: 20px;
  height: 20px;
  filter: grayscale(1) brightness(2);
}

.brand-text {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
}

.brand-highlight {
  color: #64748b;
}
</style>