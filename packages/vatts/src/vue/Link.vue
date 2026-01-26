<script setup>
import { router } from '../client/clientRouter';

const props = defineProps({
  href: {
    type: String,
    required: true
  }
});

const handleClick = async (e) => {
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