<script setup lang="ts">
defineProps<{ decoratorArg2: string }>();
</script>

<template>
  Decorator: {decoratorArg2}
  <slot></slot>
</template>
