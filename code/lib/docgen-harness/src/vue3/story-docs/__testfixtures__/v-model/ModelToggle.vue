<script setup lang="ts">
defineProps<{
  modelValue?: string;
  checked?: boolean;
}>();

defineEmits<{
  'update:modelValue': [value: string];
  'update:checked': [value: boolean];
}>();
</script>

<template>
  <label>
    <input :checked="checked" type="checkbox" />
    <span>{{ modelValue }}</span>
  </label>
</template>
