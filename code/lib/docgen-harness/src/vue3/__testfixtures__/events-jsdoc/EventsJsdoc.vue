<script setup lang="ts">
defineProps<{
  /** Visible label. */
  label: string;
}>();

const emit = defineEmits<{
  /** Emitted when the user saves the current value. */
  (e: 'save', payload: { id: number }): void;
  /** Emitted when the user cancels editing. */
  (e: 'cancel'): void;
}>();
</script>

<template>
  <button @click="emit('save', { id: 1 })">{{ label }}</button>
  <button @click="emit('cancel')">Cancel</button>
</template>
