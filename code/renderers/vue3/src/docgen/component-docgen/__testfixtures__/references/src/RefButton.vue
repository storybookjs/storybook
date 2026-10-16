<script setup lang="ts">
defineProps<{
  /** Text shown inside the button. */
  label: string;
  tone?: 'calm' | 'loud';
}>();
</script>

<template>
  <button :class="tone">{{ label }}</button>
</template>
