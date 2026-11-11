<script setup lang="ts">
// Template-declared slots without defineSlots - the most common authoring style.
// Legacy docgen reads slot names, @slot descriptions, and scoped binding names
// from the template alone; the engine swap must keep this at current or better.
const entries = ['first', 'second'];
</script>

<template>
  <section>
    <header>
      <!-- @slot Rendered above the content. -->
      <slot name="header" />
    </header>
    <slot />
    <ul>
      <li v-for="(entry, index) in entries" :key="entry">
        <!-- @slot Renders one entry; receives the entry and its position. -->
        <slot name="item" :entry="entry" :index="index" />
      </li>
    </ul>
  </section>
</template>
