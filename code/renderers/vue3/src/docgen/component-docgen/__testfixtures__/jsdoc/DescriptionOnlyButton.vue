<script lang="ts">
import { defineComponent } from 'vue';

/**
 * Component description only.
 */
export default defineComponent({
  props: {
    label: String,
  },
});
</script>

<template>
  <button>{{ label }}</button>
</template>
