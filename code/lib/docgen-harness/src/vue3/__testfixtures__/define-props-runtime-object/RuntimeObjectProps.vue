<script setup lang="ts">
import type { PropType } from 'vue';

defineProps({
  /** Visible label for the control. */
  label: { type: String, required: true },
  /** Number of repetitions. */
  count: { type: Number, default: 0 },
  /** Maps the count to a display string. */
  format: {
    type: Function as PropType<(value: number) => string>,
    default: (value: number) => String(value),
  },
});
</script>

<template>
  <span>{{ label }}: {{ format(count) }}</span>
</template>
