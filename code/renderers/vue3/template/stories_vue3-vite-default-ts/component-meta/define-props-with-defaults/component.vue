<template>
  <div>
    <p>Name: {{ name }}</p>
    <p>Category: {{ category }}</p>
  </div>
</template>

<script setup lang="ts">
interface MyComponentProps {
  /** The name of the user */
  name: string;
  /**
   * The category of the component
   *
   * @since 8.0.0
   */
  category?: string;
}

withDefaults(defineProps<MyComponentProps>(), {
  category: 'Uncategorized',
});
</script>
