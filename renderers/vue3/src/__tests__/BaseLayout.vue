<script setup lang="ts">
defineProps<{ otherProp: boolean; }>();
</script>

<template>
  <div>
    <header>
      <slot name="header" title="Some title"></slot>
    </header>
    <main>
      <slot></slot>
    </main>
    <footer>
      <slot name="footer"></slot>
    </footer>
  </div>
</template>
