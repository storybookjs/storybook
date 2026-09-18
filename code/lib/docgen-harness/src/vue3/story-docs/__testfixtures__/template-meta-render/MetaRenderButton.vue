<script setup lang="ts">
defineProps<{
  label?: string;
  variant?: string;
}>();
</script>

<template>
  <button type="button" :class="variant">{{ label }}</button>
</template>
