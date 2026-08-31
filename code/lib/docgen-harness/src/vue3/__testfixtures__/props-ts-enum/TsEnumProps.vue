<script setup lang="ts">
// The legacy vue-docgen-api path records only the bare enum NAME (sbType "other"), both for
// an imported and for a locally declared enum - the members never reach Controls, which fall
// back to a free-text input. vue-component-meta enumerates them (see cm-argtypes.snapshot).
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
