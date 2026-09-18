<script lang="ts" setup>
defineProps<{
  /** Heading text rendered above the card body. */
  heading: string;
  /**
   * Heading level applied to the rendered element.
   *
   * @default 2
   */
  level?: 2 | 3;
}>();

defineEmits<{
  /** Fired when the header is dismissed. */
  dismiss: [];
}>();
</script>

<template>
  <header>
    <component :is="`h${level ?? 2}`">{{ heading }}</component>
    <button type="button" @click="$emit('dismiss')">x</button>
  </header>
</template>
