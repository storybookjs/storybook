<script setup lang="ts">
defineProps<{
  count: number;
  label?: string;
}>();
</script>

<template>
  <p>{{ label }}: {{ count }}</p>
</template>
