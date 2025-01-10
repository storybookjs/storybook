<script lang="ts" setup>
import { StringEmpty, StringRequired, StringUndefined } from './my-props';

defineProps({
  /**
   * The foo property is required.
   * @since v1.0.0
   * @deprecated v1.1.0
   * @description This is a description of the foo property.
   */
  foo: {
    type: String,
    required: true,
  },
  /**
   * The bar property has default value
   */
  bar: {
    type: String,
    default: 'BAR',
  },
  /**
   * The baz property is optional.
   */
  baz: {
    type: String,
  },
  /**
   * The xfoo property is required.
   */
  xfoo: StringRequired,
  /**
   * The xbar property is empty.
   */
  xbar: StringEmpty,
  /**
   * The xbaz property is undefined.
   */
  xbaz: StringUndefined,
  /**
   * The hello property.
   *
   * @since v1.0.0
   */
  hello: {
    type: String,
    default: 'Hello',
  },
  numberOrStringProp: {
    type: [Number, String],
    default: 42,
  },
  arrayProps: {
    type: Array,
    default: () => [42, 43, 44],
  },
});
</script>
