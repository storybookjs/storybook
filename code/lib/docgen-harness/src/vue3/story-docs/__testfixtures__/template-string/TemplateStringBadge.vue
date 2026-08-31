<script setup lang="ts">
defineProps<{
  text?: string;
}>();
</script>

<template>
  <strong>{{ text }}</strong>
</template>
