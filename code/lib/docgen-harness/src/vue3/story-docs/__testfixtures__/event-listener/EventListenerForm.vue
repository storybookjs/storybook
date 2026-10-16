<script setup lang="ts">
defineProps<{
  label?: string;
  formatter?: (value: string) => string;
}>();

const emit = defineEmits<{
  submit: [payload: { value: string }];
}>();
</script>

<template>
  <form @submit.prevent="emit('submit', { value: label ?? '' })">
    <button type="submit">
      <slot>{{ formatter ? formatter(label ?? '') : label }}</slot>
    </button>
  </form>
</template>
