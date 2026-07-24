<script setup lang="ts">
// Reproduces #24270: scoped-slot props declared via defineSlots<> with literal
// types are extracted as name-only bindings - the literal types ("md",
// "currentColor") never reach the argTypes, which record `unknown`.
defineSlots<{
  default?: () => unknown;
  icon?: (props: { size: 'md'; fill: 'currentColor' }) => unknown;
}>();
</script>

<template>
  <button>
    <span v-if="$slots.icon">
      <slot name="icon" size="md" fill="currentColor" />
    </span>
    <slot />
  </button>
</template>
