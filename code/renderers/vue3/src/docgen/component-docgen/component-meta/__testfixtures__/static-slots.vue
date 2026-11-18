<script setup lang="ts">
defineProps<{ item?: unknown }>();
</script>

<template>
  <div>
    <slot :item="item" name="item-row">fallback content</slot>
    <slot>fallback content</slot>
  </div>
</template>
