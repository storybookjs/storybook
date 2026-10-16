<script setup lang="ts">
import type { SharedProps } from './types.ts';

defineProps<Pick<SharedProps, 'label'>>();
</script>

<template>
  <span>{{ label }}</span>
</template>
