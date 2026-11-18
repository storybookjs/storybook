<script lang="ts" setup>
defineProps<{
  /** Body text rendered inside the card. */
  content: string;
  /**
   * Visual density of the card.
   *
   * @default "comfortable"
   */
  density?: 'comfortable' | 'compact';
}>();
</script>

<template>
  <div class="card">
    <slot name="header" />
    <p>{{ content }}</p>
  </div>
</template>
