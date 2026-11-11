<script setup lang="ts">
import { ref } from 'vue';

const inputRef = ref<HTMLInputElement>();

defineProps<{ label?: string }>();
defineEmits<{ focus: []; blur: []; boarding: [] }>();

function focus(): void {
  inputRef.value?.focus();
}
function blur(): void {
  inputRef.value?.blur();
}
function onboarding(): void {
  inputRef.value?.select();
}

// The exposed members collide with the declared events on purpose: the dedup must only strip
// `onX` handler duplicates, never authored members named like an event (`focus`) or with a
// lowercase `on` continuation (`onboarding` beside a `boarding` event).
defineExpose({ focus, blur, onboarding });
</script>

<template>
  <input ref="inputRef" :aria-label="label" />
</template>
