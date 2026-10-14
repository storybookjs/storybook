<script setup lang="ts">
defineProps<{
  label?: string;
  title?: string;
}>();
</script>

<template>
  <h2 :title="title">{{ label }}</h2>
</template>
