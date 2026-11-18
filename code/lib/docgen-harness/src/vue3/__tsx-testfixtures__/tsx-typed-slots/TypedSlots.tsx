// TSX components declare their slots through the `slots` option with `SlotsType` (Vue 3.3+).
// vue-component-meta reads that option, so typed slots surface as `category: 'slots'` argTypes
// in both docgen paths, and JSDoc on each member becomes the slot description. This typing is
// the only declaration channel for TSX: template text (`<slot>`) and `@slot` JSDoc tags are
// .vue-only fallback features, and runtime consumption via `useSlots()` is invisible to any
// static extractor.
import { defineComponent, h } from 'vue';
import type { SlotsType } from 'vue';

export default defineComponent({
  name: 'TypedSlots',
  props: {
    label: { type: String, required: false },
  },
  slots: Object as SlotsType<{
    /** The content rendered inside the card. */
    default?: { content: string };
    /** Header region rendered above the content. */
    header?: { title: string };
  }>,
  setup(props, { slots }) {
    return () =>
      h('div', { class: 'typed-slots' }, [
        slots.header?.({ title: props.label ?? '' }),
        slots.default?.({ content: 'body' }),
      ]);
  },
});
