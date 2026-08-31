<script setup lang="ts">
// Reproduces #12850 and #23470: a prop and a slot share the name "icon".
// Docgen extracts both, but argTypes are keyed by bare name, so the slot entry
// is silently dropped, and the snippet generator routes the icon PROP arg into
// slot content instead of rendering a prop attribute.
defineProps<{
  /** Icon class rendered when the icon slot is empty. */
  icon?: string;
}>();
</script>

<template>
  <button class="btn">
    <!-- @slot Custom icon content; falls back to the icon prop. -->
    <slot name="icon"><i :class="icon" /></slot>
    <span><slot /></span>
  </button>
</template>
