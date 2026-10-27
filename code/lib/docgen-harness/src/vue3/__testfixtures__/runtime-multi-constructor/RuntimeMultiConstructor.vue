<script setup lang="ts">
// Reproduces #19394: a multi-constructor runtime type ([String, Number]) is
// joined into the flat display string "string|number" with sbType "other"
// instead of a structured union, so Controls cannot offer a typed input.
defineProps({
  /** Width as number of pixels or a CSS length string. */
  width: { type: [String, Number], default: 'auto' },
});
</script>

<template>
  <div :style="{ width: typeof width === 'number' ? `${width}px` : width }" />
</template>
