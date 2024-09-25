import { defineComponent, h } from 'vue';

interface SubmitPayload {
  /** Email of user */
  email: string;
  /** Password of same user */
  password: string;
}

export default defineComponent({
  emits: {
    // Validate submit event
    submit: ({ email, password }: SubmitPayload) => {
      if (email && password) {
        return true;
      }

      return false;
    },
  },
  props: {
    /** Number prop with default */
    numberDefault: {
      type: Number,
      default: 42,
    },
    /** Object prop with default */
    objectDefault: {
      type: Object,
      default: () => ({
        foo: 'bar',
      }),
    },
    /** Array prop with default */
    arrayDefault: {
      type: Array,
      default: () => [1, 2, 3],
    },
    /** Default function more complex */
    complexDefault: {
      type: Array,
      default: (props: any) => {
        if (props.arrayDefault.length > props.numberDefault) {
          return [];
        }
        return undefined;
      },
    },
  },
  render() {
    return h('pre', JSON.stringify(this.$props, null, 2));
  },
});
