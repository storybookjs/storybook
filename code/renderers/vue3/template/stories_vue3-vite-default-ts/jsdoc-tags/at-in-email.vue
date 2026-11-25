<script lang="ts">
import { defineComponent } from 'vue';

/** Mail me@example.com for help. */
export default defineComponent({
  name: 'AtInEmail',
  props: {
    /** The text. */
    label: { type: String },
  },
});
</script>

<template>
  <span>{{ label }}</span>
</template>
