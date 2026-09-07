<script setup lang="ts">
defineSlots<{
  default(): unknown;
  footer(props: { note: string }): unknown;
}>();
</script>

<template>
  <section>
    <slot />
    <footer><slot name="footer" note="hint" /></footer>
  </section>
</template>
