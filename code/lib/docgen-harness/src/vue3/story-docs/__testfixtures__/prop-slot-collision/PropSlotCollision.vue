<script setup lang="ts">
// Reproduces #12850/#23470: props and slots share arg names.
defineProps<{
  icon?: string;
  default?: string;
}>();
</script>

<template>
  <button type="button">
    <slot name="icon"><i :class="icon" /></slot>
    <span
      ><slot>{{ default }}</slot></span
    >
  </button>
</template>
