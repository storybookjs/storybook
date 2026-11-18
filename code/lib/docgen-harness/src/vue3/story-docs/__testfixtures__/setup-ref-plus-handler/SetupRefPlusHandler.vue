<script setup lang="ts">
defineProps<{
  label?: string;
  count?: number;
}>();

defineEmits<{
  increment: [];
}>();
</script>

<template>
  <button type="button" @click="$emit('increment')">{{ label }}: {{ count }}</button>
</template>
