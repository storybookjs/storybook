<script setup lang="ts">
defineProps<{
  /** Heading shown above the content. */
  heading: string;
}>();

defineSlots<{
  /** Main content area. */
  default(): unknown;
  /** Rendered above the content. */
  header(): unknown;
  /** Renders one entry; receives the entry and its position. */
  item(props: { entry: { label: string }; index: number }): unknown;
}>();

const entries = [{ label: 'first' }, { label: 'second' }];
</script>

<template>
  <section>
    <header><slot name="header" /></header>
    <h2>{{ heading }}</h2>
    <slot />
    <ul>
      <li v-for="(entry, index) in entries" :key="entry.label">
        <slot name="item" :entry="entry" :index="index" />
      </li>
    </ul>
  </section>
</template>
