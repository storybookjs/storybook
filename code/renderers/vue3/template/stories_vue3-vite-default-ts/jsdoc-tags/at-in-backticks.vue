<script lang="ts">
import { defineComponent } from 'vue';

/** Use the `@summary` tag. */
export default defineComponent({
  name: 'AtInBackticks',
  props: {
    /** The text. */
    label: { type: String },
  },
});
</script>

<template>
  <span>{{ label }}</span>
</template>
