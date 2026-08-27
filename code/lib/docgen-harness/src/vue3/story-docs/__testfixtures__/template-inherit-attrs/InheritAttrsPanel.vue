<script setup lang="ts">
defineProps<{
  label?: string;
}>();
</script>

<template>
  <section>{{ label }}</section>
</template>
