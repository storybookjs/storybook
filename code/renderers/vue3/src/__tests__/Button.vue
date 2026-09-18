<script setup lang="ts">
defineProps<{ disabled: boolean; label: string }>();

const emit = defineEmits<{
  (e: 'myChangeEvent', id: number): void;
  (e: 'myClickEvent', id: number): void;
}>();
</script>

<template>
  <button :disabled="disabled" @change="emit('myChangeEvent', 0)" @click="emit('myClickEvent', 0)">
    {{ label }}
  </button>
</template>

<style scoped></style>
