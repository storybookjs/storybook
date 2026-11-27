<script setup lang="ts">
// Reproduces #20593: PropType casts degrade - the literal union behind
// `String as PropType<'primary' | 'secondary'>` collapses to plain "string"
// (the options are lost), and a cast multi-constructor union stays an
// unstructured "other" type.
import type { PropType } from 'vue';

defineProps({
  /** Visual kind, a literal union behind a PropType cast. */
  kind: { type: String as PropType<'primary' | 'secondary'>, default: 'primary' },
  /** Mixed primitive union behind a PropType cast. */
  measure: { type: [String, Number] as PropType<string | number>, default: 0 },
});
</script>

<template>
  <span :class="kind">{{ measure }}</span>
</template>
