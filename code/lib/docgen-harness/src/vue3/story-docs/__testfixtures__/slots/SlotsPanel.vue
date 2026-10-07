<script setup lang="ts">
defineProps<{
  title?: string;
}>();
</script>

<template>
  <section>
    <header><slot name="header" /></header>
    <main><slot /></main>
    <footer><slot name="footer" /></footer>
  </section>
</template>
