<script lang="ts">
// Reproduces #22187: props spread from an imported function call are invisible
// to legacy docgen - only the inline literal prop is extracted.
import { defineComponent } from 'vue';

import { useCoreFormProps } from './useCoreFormProps.ts';

export default defineComponent({
  name: 'CrossFilePropsSpread',
  props: {
    ...useCoreFormProps(),
    /** The current value. */
    value: { type: String, required: true },
  },
});
</script>

<template>
  <input :value="value" :aria-label="label" />
</template>
