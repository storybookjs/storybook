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
export const PlainButton = defineComponent({
  props: {
    label: String,
  },
});
