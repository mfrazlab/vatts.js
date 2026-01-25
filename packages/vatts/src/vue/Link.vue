<script setup lang="ts">
import { router } from '../client/clientRouter';

interface LinkProps {
  href: string;
}

const props = defineProps<LinkProps>();

const handleClick = async (e: MouseEvent) => {
  e.preventDefault();

  // Usa o novo sistema de router
  await router.push(props.href);
};
</script>

<template>
  <a :href="href" @click="handleClick">
    <slot></slot>
  </a>
</template>