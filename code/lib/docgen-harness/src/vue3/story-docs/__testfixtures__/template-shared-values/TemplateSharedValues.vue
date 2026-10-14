<script setup lang="ts">
defineProps<{
  items?: unknown[];
  label?: string;
}>();
</script>

<template>
  <p>{{ label }} {{ JSON.stringify(items) }}</p>
</template>
