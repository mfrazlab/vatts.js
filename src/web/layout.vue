<script lang="ts">
import Navbar from '@/web/components/Navbar.vue';
import type { Metadata } from "vatts/vue";
export const metadata: Metadata = {
  title: "Vatts.js | The Fastest Framework for React",
  description: "The fastest and simplest web framework for React! Start building high-performance web applications today with Vatts.js.",
  favicon: '/logo.png',
  scripts: {
    "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2662588853991140": {
      "crossorigin": 'anonymous',
      "async": ""
    }
  }
};
</script>

<script setup lang="ts">
import './globals.css';
import { router } from 'vatts/vue'; // Necessário para identificar a mudança de página

// Equivalente ao onExitComplete={() => window.scrollTo(0, 0)}
function onAfterLeave() {
  window.scrollTo(0, 0);
}
</script>

<template>
  <Navbar />
  <slot />
</template>

<style>
/* Define a duração e a curva de transição.
  cubic-bezier(0.22, 1, 0.36, 1) é a conversão CSS do ease: [0.22, 1, 0.36, 1]
*/
.page-transition-enter-active,
.page-transition-leave-active {
  transition: opacity 0.3s, transform 0.3s, filter 0.3s;
  transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}

/* Estado inicial de entrada (hidden) e final de saída (exit).
  opacity: 0, scale: 0.98, filter: blur(5px)
*/
.page-transition-enter-from,
.page-transition-leave-to {
  opacity: 0;
  transform: scale(0.98);
  filter: blur(5px);
}

/* Estado ativo (enter) é o padrão do elemento, então não precisa declarar explicitamente o 'to' */
</style>