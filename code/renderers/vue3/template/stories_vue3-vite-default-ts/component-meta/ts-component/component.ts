import { defineComponent, h } from 'vue';

export default defineComponent({
  props: {
    /** String foo */
    foo: {
      type: String,
      required: true,
    },
    /** Optional number bar */
    bar: {
      type: Number,
    },
  },
  setup(props) {
    return () => h('pre', JSON.stringify(props, null, 2));
  },
});
