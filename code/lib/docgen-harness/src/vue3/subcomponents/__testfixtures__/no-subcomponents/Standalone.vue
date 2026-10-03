<script lang="ts" setup>
defineProps<{
  /** Text rendered inside the element. */
  label: string;
}>();
</script>

<template>
  <span>{{ label }}</span>
</template>
