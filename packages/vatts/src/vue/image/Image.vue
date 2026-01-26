<!--
 * This file is part of the Vatts.js Project.
 * Copyright (c) 2026 itsmuzin
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 -->

<script setup>
import { computed } from 'vue';

const props = defineProps({
  src: {
    type: String,
    required: true
  },
  width: [Number, String],
  height: [Number, String],
  quality: {
    type: Number,
    default: 75
  },
  priority: {
    type: Boolean,
    default: false
  },
  alt: {
    type: String,
    default: ""
  }
});

const getBaseUrl = () => {
  if (typeof window === "undefined") return null;
  return window.location.origin;
};

const optimizedSrc = computed(() => {
  const baseUrl = getBaseUrl();
  const { src, quality, width, height } = props;

  // Se a imagem for Base64 (pequena) ou externa (http), não otimizamos via backend local
  const isOptimizable = src && typeof src === 'string' && !src.startsWith('data:') &&
      ((baseUrl && src.startsWith(baseUrl)) || !src.startsWith('http'));

  if (!isOptimizable) return src;

  let path = src;
  if (baseUrl && path.startsWith(baseUrl)) {
    path = path.slice(baseUrl.length) || '/';
  }

  const params = new URLSearchParams();
  params.set('url', path);

  // Tratamento para remover "px" se o usuário passar string
  if (width) {
    const w = String(width).replace('px', '');
    if (!isNaN(Number(w))) params.set('w', w);
  }

  if (height) {
    const h = String(height).replace('px', '');
    if (!isNaN(Number(h))) params.set('h', h);
  }

  if (quality) params.set('q', quality.toString());

  return `/_vatts/image?${params.toString()}`;
});

const baseStyle = computed(() => {
  return {
    width: props.width ? (typeof props.width === 'number' ? `${props.width}px` : props.width) : 'auto',
    height: props.height ? (typeof props.height === 'number' ? `${props.height}px` : props.height) : 'auto',
  };
});

// Remove "px" para os atributos nativos width/height da tag img
const cleanDimension = (val) => {
  if (typeof val === 'string') return val.replace('px', '');
  return val;
};
</script>

<template>
  <img
      v-bind="$attrs"
      :src="optimizedSrc"
      :alt="alt"
      :loading="priority ? 'eager' : 'lazy'"
      :decoding="priority ? 'sync' : 'async'"
      :width="cleanDimension(width)"
      :height="cleanDimension(height)"
      :style="baseStyle"
      class="vatts-image"
  />
</template>