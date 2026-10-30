<script setup lang="ts">
defineProps<{
  /** Main body copy of the card. */
  content: string;
  elevated?: boolean;
}>();

defineEmits<{ action: [cause: string] }>();
</script>

<template>
  <section :class="{ elevated }">
    <slot name="header" />
    <p>{{ content }}</p>
    <slot />
  </section>
</template>
