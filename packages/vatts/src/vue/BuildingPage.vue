<script setup>
import { onMounted, ref } from 'vue';

const version = ref("1.0.0");

try {
  version.value = require("../../package.json").version;
} catch (e) {}

// CSS extraído para evitar que o Vue escape caracteres como '>' ou aspas
// ATUALIZADO: Paleta de cores alterada para Vue.js Green
const cssStyles = `
  :root {
    --bg-solid: #000000;
    --card-bg: #0a0a0a;
    /* PALETA: Vue.js Theme */
    --vue-green: #42b883;       /* O verde principal do Vue */
    --vue-dark: #35495e;        /* O azul escuro secundário do Vue (para substituir cinzas escuros) */
    --primary: #ffffff;
    --text-main: #ffffff;
    /* Mudei o texto mudo de cinza para um tom mais claro do verde */
    --text-muted: #a7c4bc;
  }

  body {
    margin: 0;
    padding: 0;
    width: 100vw;
    height: 100vh;
    background-color: var(--bg-solid);
    font-family: 'Inter', sans-serif;
    color: var(--text-main);
    overflow: hidden;
    position: relative;
  }

  .container {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    pointer-events: none;
  }

  .build-card {
    pointer-events: auto;
    position: relative;
    width: 100%;
    max-width: 420px;
    background: var(--card-bg);
    /* Borda sutil, mudei o brilho para verde */
    box-shadow: 0 0 0 1px rgba(66, 184, 131, 0.1), 0 40px 80px -20px rgba(0, 0, 0, 0.9);
    border-radius: 20px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .neon-line {
    height: 1px;
    width: 100%;
    /* Linha de luz: Mudei do gradiente cinza/branco para o verde Vue */
    background: linear-gradient(90deg, transparent, var(--vue-dark), var(--vue-green), var(--vue-dark), transparent);
    box-shadow: 0 0 15px rgba(66, 184, 131, 0.2);
  }

  .content {
    padding: 40px 32px;
    width: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .logo-wrapper {
    position: relative;
    margin-bottom: 24px;
  }

  .logo-wrapper img {
    width: 64px;
    height: 64px;
    object-fit: contain;
    position: relative;
    z-index: 2;
    /* Removi o filtro grayscale para a logo do Vue brilhar na cor original */
    filter: none;
  }

  .logo-glow {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 100%;
    height: 100%;
    /* Mudei o brilho de fundo de branco para Verde Vue */
    background: var(--vue-green);
    filter: blur(25px);
    opacity: 0.2; /* Aumentei um pouco a opacidade para destacar o verde */
    border-radius: 50%;
    animation: pulse 2s ease-in-out infinite;
  }

  h1 {
    margin: 0;
    font-size: 2rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    /* Gradiente do texto: De branco para Verde Vue */
    background: linear-gradient(180deg, #ffffff 0%, var(--vue-green) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  h1 span {
    /* O ".js" agora é verde sólido */
    color: var(--vue-green);
    -webkit-text-fill-color: var(--vue-green);
  }

  p {
    margin: 8px 0 32px 0;
    color: var(--text-muted);
    font-size: 0.9rem;
    font-weight: 500;
  }

  .terminal-box {
    width: 100%;
    background: rgba(66, 184, 131, 0.03); /* Fundo sutilmente verde */
    border: 1px solid rgba(66, 184, 131, 0.1); /* Borda verde sutil */
    border-radius: 12px;
    padding: 16px;
    text-align: left;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    /* Cor do texto base do terminal alterada de cinza para um tom claro */
    color: var(--text-muted);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .term-line {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .term-spinner {
    width: 10px;
    height: 10px;
    border: 2px solid rgba(66, 184, 131, 0.1); /* Borda inativa verde clara */
    border-top-color: var(--vue-green); /* Spinner ativo verde vibrante */
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  .file-name {
    /* Nomes de arquivo agora num tom azulado/esverdeado claro */
    color: #8fa3b3;
  }
  .accent {
    /* O destaque "src/vatts.ts" agora é Verde Vue */
    color: var(--vue-green);
  }

  .card-footer {
    width: 100%;
    padding: 12px 32px;
    background: rgba(66, 184, 131, 0.03); /* Fundo sutil verde */
    border-top: 1px solid rgba(66, 184, 131, 0.05); /* Borda sutil verde */
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    color: rgba(255,255,255,0.4);
    box-sizing: border-box;
  }

  .status-active {
    display: flex;
    align-items: center;
    gap: 6px;
    /* Texto de status e versão agora em Verde Vue */
    color: var(--vue-green);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .dot {
    width: 6px;
    height: 6px;
    /* O ponto de status agora é Verde Vue com brilho verde */
    background-color: var(--vue-green);
    border-radius: 50%;
    box-shadow: 0 0 8px var(--vue-green);
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.15; transform: translate(-50%, -50%) scale(1); }
    50% { opacity: 0.25; transform: translate(-50%, -50%) scale(1.1); }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

// Script de reload extraído
const clientReloadScript = `
  setTimeout(() => {
    window.location.reload();
  }, 2500);
`;
</script>

<template>
  <html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vatts.js | Building...</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

    <style v-html="cssStyles"></style>
  </head>
  <body>
  <div class="building-screen-body">
    <div class="container">
      <div class="build-card">
        <div class="neon-line"></div>

        <div class="content">
          <div class="logo-wrapper">
            <div class="logo-glow"></div>
            <img src="https://raw.githubusercontent.com/mfrazlab/vatts.js/docs/public/logo.png" alt="Vatts Logo" />
          </div>

          <h1>Vatts<span>.js</span></h1>
          <p>Building your application...</p>

          <div class="terminal-box">
            <div class="term-line">
              <div class="term-spinner"></div>
              <span class="file-name">Compiling <span class="accent">src/vatts.ts</span>...</span>
            </div>
            <div class="term-line" style="opacity: 0.5">
              <span style="color: var(--vue-green)">✓</span>
              <span class="file-name">Optimizing assets</span>
            </div>
          </div>
        </div>

        <div class="card-footer">
          <span>Building...</span>
          <div class="status-active">
            <div class="dot"></div>
            v{{ version }}
          </div>
        </div>
      </div>
    </div>
  </div>

  <script v-html="clientReloadScript"></script>
  </body>
  </html>
</template>