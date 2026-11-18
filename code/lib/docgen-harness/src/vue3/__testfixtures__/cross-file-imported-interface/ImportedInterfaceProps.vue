<script setup lang="ts">
import type { SharedProps } from './types.ts';

defineProps<SharedProps>();
</script>

<template>
  <span v-for="i in count ?? 1" :key="i">{{ label }}</span>
</template>
