<script setup lang="ts">
/**
 * Import override button.
 *
 * @import import { ImportOverride } from 'my-design-system';
 */
defineProps<{
  label?: string;
}>();
</script>

<template>
  <button type="button">{{ label }}</button>
</template>
