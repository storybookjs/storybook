<script setup lang="ts">
import { Severity } from './severity';

/** Locally declared numeric enum, to cover the member values that are not strings. */
enum Level {
  Low,
  High,
}

defineProps<{
  /** Alert severity, an imported string enum. */
  severity: Severity;
  /** Priority, a locally declared numeric enum. */
  level?: Level;
  /** A plain literal union, for comparison with the enum-backed props above. */
  size?: 'small' | 'medium' | 'large';
}>();
</script>

<template>
  <div :class="`severity-${severity}`">
    <span>severity: {{ severity }}</span>
    <span>level: {{ level }}</span>
    <span>size: {{ size }}</span>
  </div>
</template>
