<script setup lang="ts">
const { label = '你好', size = '大きい', icon = '✨' } = defineProps<{
  /**
   * Greeting label.
   */
  label?: string;
  /**
   * Size label.
   */
  size?: string;
  /**
   * Decorative icon.
   */
  icon?: string;
}>();
</script>

<template>
  <p>{{ label }} - {{ size }} - {{ icon }}</p>
</template>
