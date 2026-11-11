<script setup lang="ts">
defineProps<{
  value: string;
}>();
</script>

<template>
  <input :value="value" />
</template>
