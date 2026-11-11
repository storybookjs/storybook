<script setup lang="ts">
import type { SharedProps } from './types.ts';

// The intersection sits on a single prop's own type: placed as the whole
// defineProps<> type argument instead, vue-docgen-api extracts no props at all
// (only TSTypeLiteral/TSTypeReference are handled at that position); that
// empty whole-shape baseline is recorded in type-intersection-whole/ (#30045).
defineProps<{
  /** Combined shape contributed by the intersection. */
  mixed: SharedProps & { extra: boolean };
}>();
</script>

<template>
  <span :data-extra="mixed.extra">{{ mixed.label }}</span>
</template>
