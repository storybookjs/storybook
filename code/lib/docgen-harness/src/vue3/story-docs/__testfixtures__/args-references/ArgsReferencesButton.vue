<script setup lang="ts">
defineProps<{
  label?: string;
  options?: {
    size: string;
    tone: string;
  };
}>();
</script>

<template>
  <button type="button" :data-size="options?.size">{{ label }}</button>
</template>
