<script setup lang="ts">
defineProps<{
  html: string;
  lines: number;
  selectedLine?: number;
  heading?: string;
}>();
</script>

<template>
  <section :aria-label="heading">
    <div v-html="html" />
    <span>{{ selectedLine ?? 0 }} / {{ lines }}</span>
  </section>
</template>
