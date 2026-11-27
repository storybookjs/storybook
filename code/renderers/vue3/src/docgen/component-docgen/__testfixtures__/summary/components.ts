import { defineComponent } from 'vue';

/**
 * A tag that labels an item.
 *
 * @summary for labels
 */
export const Tag = defineComponent({
  props: { label: String },
});

/** A chip that is exported below its declaration. */
const Chip = defineComponent({
  props: { label: String },
});

export { Chip };
