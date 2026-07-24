<script setup lang="ts">
// Reproduces #26465: with the vue-component-meta engine, a component combining
// documented props (withDefaults) and defineSlots loses its prop meta - the docs
// page shows neither doc comments nor default values.
withDefaults(
  defineProps<{
    /** Visible label of the button. */
    label?: string;
    /** Whether the button is disabled. */
    disabled?: boolean;
  }>(),
  {
    label: 'Button',
    disabled: false,
  }
);

defineSlots<{
  /** Main content, rendered instead of the label. */
  default?: () => unknown;
  /** Icon rendered before the content. */
  icon?: (props: { size: string }) => unknown;
}>();
</script>

<template>
  <button :disabled="disabled">
    <slot name="icon" size="md" />
    <slot>{{ label }}</slot>
  </button>
</template>
