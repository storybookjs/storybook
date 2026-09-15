<script setup lang="ts">
defineProps<{
  /** Heading text rendered above the card body. */
  heading: string;
}>();
</script>

<template>
  <header>
    <h3>{{ heading }}</h3>
  </header>
</template>
