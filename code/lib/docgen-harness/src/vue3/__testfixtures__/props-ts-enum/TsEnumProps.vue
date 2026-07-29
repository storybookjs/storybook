<script setup lang="ts">
// TypeScript enum props record only the bare enum NAME (sbType "other"), both for
// an imported and for a locally declared enum - the members never reach Controls,
// which fall back to a free-text input.
import { Severity } from './severity.ts';

enum Level {
  Low,
  High,
}

defineProps<{
  /** Alert severity, an imported string enum. */
  severity: Severity;
  /** Priority, a locally declared numeric enum. */
  level?: Level;
}>();
</script>

<template>
  <div :class="severity" :data-level="level"><slot /></div>
</template>
