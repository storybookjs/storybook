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
