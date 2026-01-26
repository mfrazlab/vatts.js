<script lang="ts">
// Importamos o tipo Metadata de vatts/vue (assumindo a paridade com a versão React)
import type { Metadata } from "vatts/vue";

export const metadata: Metadata = {
  title: "Vatts JS | The Fast and Simple Web Framework for React",
  description: "The fastest and simplest web framework for React! Start building high-performance web applications today with Vatts JS.",
  keywords: ["Vatts JS", "web framework", "React", "JavaScript", "TypeScript", "web development", "fast", "simple", "SSR", "frontend"],
  author: "Vatts JS Team",
};
</script>

<script setup lang="ts">
import './globals.css';
</script>

<template>
    <slot />
</template>