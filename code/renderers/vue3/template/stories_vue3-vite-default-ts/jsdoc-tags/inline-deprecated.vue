<script lang="ts">
import { defineComponent } from 'vue';

/** A component. @deprecated Use another component. */
export default defineComponent({
  name: 'InlineDeprecated',
  props: {
    /** The text. */
    label: { type: String },
  },
});
</script>

<template>
  <span>{{ label }}</span>
</template>
