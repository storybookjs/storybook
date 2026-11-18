<script setup lang="ts">
defineProps<{
  /** Shown. */
  label: string;
  /**
   * Internal only.
   *
   * @ignore
   */
  internal?: string;
}>();

defineEmits<{
  /** Shown. */
  change: [value: string];
  /**
   * Internal only.
   *
   * @ignore
   */
  debug: [];
}>();

defineSlots<{
  /** Shown. */
  default(): unknown;
  /**
   * Internal only.
   *
   * @ignore
   */
  internal(): unknown;
}>();
</script>

<template>
  <button><slot />{{ label }}</button>
</template>
