<script setup lang="ts">
/**
 * Component-level docblock with tags: vue-docgen-api never captures this block in a
 * script-setup SFC (only a docblock attached to a defineOptions() call is read), so it
 * appears in no recorded baseline - kept here to pin that invisibility.
 *
 * @deprecated Use the modern control instead.
 * @see https://storybook.js.org
 */
defineProps<{
  /**
   * Visible label.
   *
   * @deprecated Prefer `title`.
   * @since 10.0
   */
  label?: string;
  /**
   * Preferred title text.
   *
   * @default "Untitled"
   */
  title?: string;
}>();
</script>

<template>
  <span :title="title">{{ label ?? title }}</span>
</template>
