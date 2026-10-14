<script setup lang="ts">
// Runtime-array emits on purpose: beside `defineModel`, Volar drops runtime-declared events
// (typed `defineEmits<...>` survives), so this guards the vue-docgen-api fallback restoring them.
const modelValue = defineModel<string>();

const emit = defineEmits(['blur']);
</script>

<template>
  <input
    :value="modelValue"
    @input="modelValue = ($event.target as HTMLInputElement).value"
    @blur="emit('blur')"
  />
</template>
