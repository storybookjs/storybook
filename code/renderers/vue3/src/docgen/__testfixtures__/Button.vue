<script setup lang="ts">
/**
 * Script setup component-file docs are not attached to the component symbol.
 *
 * @deprecated This component-file tag should not surface.
 */
defineProps<{
  /** Text shown inside the button. */
  label: string;
  size?: 'small' | 'large';
}>();

defineEmits<{ click: [value: string] }>();
defineSlots<{ default(): unknown; icon(): unknown }>();
</script>

<template>
  <button :class="size">
    <slot name="icon" />
    <slot>{{ label }}</slot>
  </button>
</template>
