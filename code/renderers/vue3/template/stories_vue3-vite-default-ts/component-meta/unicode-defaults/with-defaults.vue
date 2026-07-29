<script setup lang="ts">
withDefaults(
  defineProps<{
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
  }>(),
  {
    label: 'こんにちは',
    size: '大きい',
    icon: '🚀',
  }
);
</script>

<template>
  <p>{{ label }} - {{ size }} - {{ icon }}</p>
</template>
