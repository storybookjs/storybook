<script setup lang="ts">
defineProps<{
  /** Badge text. */
  text: string;
  tone?: 'info' | 'warn';
}>();
</script>

<template>
  <span :class="tone">{{ text }}</span>
</template>
