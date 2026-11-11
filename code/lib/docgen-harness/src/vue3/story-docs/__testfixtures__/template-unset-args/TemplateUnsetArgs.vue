<script setup lang="ts">
withDefaults(
  defineProps<{
    id: string;
    label?: string;
    hint?: string;
    modelValue?: string;
  }>(),
  {
    id: 'testid',
  }
);

defineEmits<{
  clear: [];
  'update:modelValue': [value: string];
}>();
</script>

<template>
  <label :for="id">{{ label }}</label>
  <input :id="id" :value="modelValue" />
  <p>{{ hint }}</p>
</template>
