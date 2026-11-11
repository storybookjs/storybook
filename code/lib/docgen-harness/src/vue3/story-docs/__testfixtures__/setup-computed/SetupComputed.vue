<script setup lang="ts">
defineProps<{
  label: string;
  hint?: string;
}>();
</script>

<template>
  <p>
    <span>{{ label }}</span>
    <small>{{ hint }}</small>
  </p>
</template>
