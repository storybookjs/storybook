<script setup lang="ts">
defineProps<{
  /** Card title shown in the header. */
  title: string;
}>();

const emit = defineEmits<{
  /** Fired when the card is dismissed. */
  (e: 'dismiss'): void;
}>();
</script>

<template>
  <section>
    <header>
      <!-- @slot Rendered before the title. -->
      <slot name="leading" />
      <h2>{{ title }}</h2>
      <button @click="emit('dismiss')">×</button>
    </header>
    <!-- @slot The card body. -->
    <slot />
  </section>
</template>
