<script setup lang="ts">
import { ref } from 'vue';

const inputRef = ref<HTMLInputElement>();

defineProps<{ label?: string }>();
defineEmits<{ focus: []; blur: [] }>();

function focus(): void {
  inputRef.value?.focus();
}
function blur(): void {
  inputRef.value?.blur();
}

// The exposed members share their names with the declared events on purpose: the argTypes
// dedup must only strip `onX` handler duplicates, never authored `defineExpose` members.
defineExpose({ focus, blur });
</script>

<template>
  <input ref="inputRef" :aria-label="label" />
</template>
