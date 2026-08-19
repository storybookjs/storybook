<script>
// Options API on purpose: Volar only infers template slots for `<script setup>` components, so
// this fixture guards the vue-docgen-api fallback that restores them on the successor engines.
export default {
  name: 'OptionsApiSlots',
  props: {
    heading: { type: String, default: 'Title' },
  },
};
</script>

<template>
  <section>
    <h2>{{ heading }}</h2>
    <!-- @slot Rendered above the content. -->
    <slot name="header" />
    <!-- @slot The main content area. -->
    <slot />
    <ul>
      <li v-for="(entry, index) in ['first', 'second']" :key="entry">
        <!-- @slot Renders one entry; receives the entry and its position. -->
        <slot name="item" :entry="entry" :index="index" />
      </li>
    </ul>
  </section>
</template>
