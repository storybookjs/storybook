<script setup lang="ts">
type Shape = 'square' | 'circle';

interface Base {
  label?: string;
  tone?: 'loud' | 'quiet';
  ring?: 'thin' | 'thick';
}

defineProps<
  Omit<Base, 'label'> & {
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    shape?: Shape;
    count?: 3 | 1 | 2;
  }
>();
</script>

<template><i /></template>
