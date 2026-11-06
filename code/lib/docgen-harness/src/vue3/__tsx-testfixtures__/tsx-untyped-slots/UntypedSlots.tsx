// Control fixture: slots consumed programmatically via `useSlots()` with no explicit typing.
// Static extraction cannot see these slots, so the docgen must stay cleanly empty for them —
// no phantom slot entries — while declared props still document. Typing the slots (see
// tsx-typed-slots) is the only way to make them visible.
import { defineComponent, h, useSlots } from 'vue';

export default defineComponent({
  name: 'UntypedSlots',
  props: {
    label: { type: String, required: false },
  },
  setup() {
    const slots = useSlots();
    return () => h('div', { class: 'untyped-slots' }, slots.default?.());
  },
});
