<script setup lang="ts">
defineProps<{ decoratorArg: string }>();
</script>

<template>
  Decorator: {decoratorArg}
  <slot></slot>
</template>
