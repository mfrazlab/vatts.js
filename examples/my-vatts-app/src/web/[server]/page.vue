<script setup>
// Definindo a prop que vem do seu roteador (Vatts.js)
const props = defineProps({
  params: {
    type: Object,
    default: () => ({})
  }
});

// Print no console para conferir
console.log('Server parameter:', props.params?.server);
</script>

<template>
  <div class="container">
    <div class="group-wrapper">
      <div class="gradient-blur"></div>

      <div class="card">
        <h1 class="title">
          Hello <span class="gradient-text">{{ props.params?.server || 'World' }}</span>
        </h1>

        <p class="subtitle">
          Running with <span class="subtitle-highlight">Vatts.js</span>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* O CSS permanece exatamente o mesmo que você enviou */
.container {
  display: flex;
  min-height: 100vh;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #030712;
  padding: 1rem;
  text-align: center;
  font-family: sans-serif;
}

.group-wrapper {
  position: relative;
}

.gradient-blur {
  position: absolute;
  top: -4px;
  right: -4px;
  bottom: -4px;
  left: -4px;
  border-radius: 0.5rem;
  background: linear-gradient(to right, #9333ea, #22d3ee);
  filter: blur(8px);
  transition: opacity 500ms ease;
  opacity: 0.25;
}

.group-wrapper:hover .gradient-blur {
  opacity: 0.5;
}

.card {
  position: relative;
  border-radius: 0.5rem;
  background-color: #111827;
  padding: 1.5rem 2rem;
  border: 1px solid #1f2937;
  color: white;
}

.title {
  margin-bottom: 0.5rem;
  font-size: 2.25rem;
  font-weight: bold;
  letter-spacing: -0.025em;
  color: white;
  line-height: 1;
}

.gradient-text {
  color: transparent;
  background-clip: text;
  -webkit-background-clip: text;
  background-image: linear-gradient(to right, #c084fc, #22d3ee);
}

.subtitle {
  font-size: 0.875rem;
  font-weight: 500;
  color: #9ca3af;
  margin: 0;
}

.subtitle-highlight {
  color: #e5e7eb;
}
</style>