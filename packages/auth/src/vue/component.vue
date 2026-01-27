<script setup lang="ts">
/**
 * This file is part of the Vatts.js Project.
 * Copyright (c) 2026 mfraz
 */
import { useSessionProviderLogic } from './session';

// Definição das props com valores padrão
const props = withDefaults(defineProps<{
  basePath?: string;
  refetchInterval?: number;
  refetchOnWindowFocus?: boolean;
}>(), {
  basePath: '/api/auth',
  refetchInterval: 0,
  refetchOnWindowFocus: true
});

// Inicializa a lógica do provider passando as props reativas
useSessionProviderLogic(props);
</script>

<template>
  <slot />
</template>