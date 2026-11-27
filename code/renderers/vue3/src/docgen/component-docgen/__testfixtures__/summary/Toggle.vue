<script lang="ts">
/** A toggle that switches a setting on or off. */
export default {
  inheritAttrs: false,
};
</script>

<script setup lang="ts">
/** Docs in script setup are not the component's. */
defineProps<{ label: string }>();
</script>

<template>
  <button>{{ label }}</button>
</template>
