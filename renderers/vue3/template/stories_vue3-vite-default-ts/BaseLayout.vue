<script setup lang="ts">
defineProps({
  label: String,
});
</script>
<template>
  <div>
    <header data-testid="header-slot">
      <slot name="header" title="Header title from the slot"></slot>
    </header>
    <main data-testid="default-slot">
      <slot></slot>
    </main>
    <footer data-testid="footer-slot">
      <slot name="footer"></slot>
    </footer>
  </div>
</template>
