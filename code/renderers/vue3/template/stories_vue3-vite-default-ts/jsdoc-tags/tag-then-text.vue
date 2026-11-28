<script lang="ts">
import { defineComponent } from 'vue';

/**
 * A component.
 * @summary a component
 * Ask @design first.
 */
export default defineComponent({
  name: 'TagThenText',
  props: {
    /** The text. */
    label: { type: String },
  },
});
</script>

<template>
  <span>{{ label }}</span>
</template>
