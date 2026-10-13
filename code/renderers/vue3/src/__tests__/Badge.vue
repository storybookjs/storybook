<script setup lang="ts">
defineProps<{ variant: 'primary' | 'secondary'; label: string }>();
</script>

<template>
  <span :class="variant">{{ label }}</span>
</template>
