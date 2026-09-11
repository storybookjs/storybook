<script setup lang="ts">
defineProps<{
  hidden?: boolean;
  label?: string;
}>();
</script>

<template>
  <section>{{ label }}</section>
</template>
