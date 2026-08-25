<script setup lang="ts">
defineProps<{
  title?: string;
  titleTag?: string;
  modelValue?: string;
}>();

defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<template>
  <section>
    <component :is="titleTag ?? 'h3'">
      <slot name="title">{{ title }}</slot>
    </component>
    <slot />
  </section>
</template>
