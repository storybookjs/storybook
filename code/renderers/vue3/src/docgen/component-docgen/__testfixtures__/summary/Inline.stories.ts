import { defineComponent } from 'vue';

/** A component declared in its story file. */
const Inline = defineComponent({
  props: { label: String },
});

export default { component: Inline };

export const Default = {};
