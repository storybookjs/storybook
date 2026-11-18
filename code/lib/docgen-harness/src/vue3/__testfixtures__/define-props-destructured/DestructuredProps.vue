<script setup lang="ts">
const { size = 'medium', label } = defineProps<{
  /** The visual size of the control. */
  size?: 'small' | 'medium' | 'large';
  /** Visible label. */
  label: string;
}>();
</script>

<template>
  <span :class="`is-${size}`">{{ label }}</span>
</template>
