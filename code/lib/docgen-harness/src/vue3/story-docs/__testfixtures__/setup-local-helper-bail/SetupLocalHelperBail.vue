<script setup lang="ts">
defineProps<{
  label?: string;
  badge?: string;
}>();
</script>

<template>
  <span>
    {{ label }}
    <strong>{{ badge }}</strong>
  </span>
</template>
