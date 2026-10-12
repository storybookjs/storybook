<script lang="ts">
import { defineComponent } from 'vue';

/**
 * Renders with {@link IconButton} in prose.
 * Use together with @see ButtonGroup for accessibility.
 *
 * @deprecated Use NewButton.
 * @example
 * <sb-button label="Save">
 *   Save
 * </sb-button>
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
