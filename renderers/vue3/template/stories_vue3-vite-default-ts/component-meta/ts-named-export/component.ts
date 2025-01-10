import type { PropType } from 'vue';
import { defineComponent, h } from 'vue';

export const ComponentA = defineComponent({
  name: 'MyCompo1',
  props: {
    /**
     * This is a description of the prop
     *
     * @defaultValue 'medium'
     * @values 'small', 'medium', 'large'
     * @control select
     * @group Size
     */
    size: {
      type: String as PropType<'small' | 'medium' | 'large'>,
      default: 'medium',
    },
    /**
     * This is a description of the prop
     *
     * @defaultValue false
     * @control color
     * @group Style
     */
    backgroundColor: {
      type: String,
      default: 'red',
    },
  },
  setup(props: any) {
    return () => h('pre', JSON.stringify(props, null, 2));
  },
});

export const ComponentB = defineComponent({
  name: 'MyCompo2',
  props: {
    /**
     * This is a description of the prop
     *
     * @defaultValue false
     * @values true, false
     * @control boolean
     * @group Size
     */
    primary: {
      type: Boolean,
      default: false,
    },
  },
  setup(props: any) {
    return () => h('pre', JSON.stringify(props, null, 2));
  },
});
