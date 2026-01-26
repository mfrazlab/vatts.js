<script setup>
// Nenhuma lógica necessária para este componente visual
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-gray-950 p-4 text-center">
    <div class="group relative">
      <div class="absolute -inset-1 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-400 opacity-25 blur transition duration-500 group-hover:opacity-50"></div>
      <div class="relative rounded-lg bg-gray-900 px-8 py-6 ring-1 ring-gray-800">
        <h1 class="mb-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Hello <span class="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">World</span>
        </h1>

        <p class="text-sm font-medium text-gray-400">
          Running with <span class="text-gray-200">Vatts.js</span>
        </p>
      </div>
    </div>
  </div>
</template>