<script setup lang="ts">
defineProps<{ slotName?: string }>();
</script>

<template>
  <div class="dynamic-outlet">
    <slot :name="slotName">fallback content</slot>
  </div>
</template>
