import type { PropType } from 'vue';

export function useCoreFormProps() {
  return {
    /** Accessible label. */
    label: { type: String as PropType<string>, required: true },
    /** Whether the field may be left empty. */
    optional: { type: Boolean, default: false },
  };
}
