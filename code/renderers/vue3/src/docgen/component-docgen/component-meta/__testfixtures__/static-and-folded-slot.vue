<script setup lang="ts">
defineProps<{ which?: string }>();
</script>

<template>
  <div>
    <slot name="header">static header</slot>
    <slot :name="which ?? 'header'">dynamic header</slot>
  </div>
</template>
