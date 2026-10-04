<script lang="ts">
// Plain script block on purpose: `generic` lives on the setup tag only, and the extractor must
// not stop at (or mis-attribute) this first tag.
export const PROPS_GENERIC_KIND = 'list';
</script>

<script setup lang="ts" generic="T">
defineProps<{
  /** Items rendered in order. */
  items: T[];
  /** Currently selected item. */
  selected?: T;
}>();
</script>

<template>
  <ul>
    <li v-for="(item, index) in items" :key="index">{{ item }}</li>
  </ul>
</template>
