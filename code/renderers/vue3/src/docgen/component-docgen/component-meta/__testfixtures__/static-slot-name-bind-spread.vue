<script setup lang="ts">
defineProps<{ dynamicName?: string; item?: unknown }>();
</script>

<template>
  <div>
    <slot name="header" v-bind="{ name: dynamicName, item }">fallback content</slot>
  </div>
</template>
