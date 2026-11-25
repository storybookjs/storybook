<script lang="ts">
import { defineComponent } from 'vue';

/** A component. Ask @design before you change it. */
export default defineComponent({
  name: 'AtInProse',
  props: {
    /** The text. */
    label: { type: String },
  },
});
</script>

<template>
  <span>{{ label }}</span>
</template>
