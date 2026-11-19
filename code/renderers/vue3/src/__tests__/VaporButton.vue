<script setup vapor lang="ts">
defineProps<{ disabled: boolean; label: string }>();

const emit = defineEmits<{
  (e: 'myClickEvent', id: number): void;
}>();
</script>

<template>
  <button :disabled="disabled" @click="emit('myClickEvent', 0)">{{ label }}</button>
</template>
