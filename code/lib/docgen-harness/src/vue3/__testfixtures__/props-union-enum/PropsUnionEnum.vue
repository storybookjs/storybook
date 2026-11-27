<script setup lang="ts">
interface Props {
  /** The visual size of the control. */
  size: 'small' | 'medium' | 'large';
  /** Loose value that accepts several primitive shapes. */
  status?: string | number | boolean;
}

defineProps<Props>();
</script>

<template>
  <div :class="`is-${size}`">{{ status }}</div>
</template>
