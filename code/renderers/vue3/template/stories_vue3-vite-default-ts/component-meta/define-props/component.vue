<template>
  <div>
    <p>Name: {{ name }}</p>
    <p>Category: {{ category }}</p>
  </div>
</template>

<script setup>
const props = defineProps({
  /** The name of the user */
  name: { type: String, required: true },
  /**
   * The category of the component
   *
   * @since 8.0.0
   */
  category: { type: String, default: 'Uncategorized' },
});
</script>
