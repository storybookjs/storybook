<script lang="ts">
import { VNode, defineComponent } from 'vue';

export default defineComponent({
  name: 'ClassSlotsComponent',
  setup() {
    return {};
  },
}) as unknown as new () => {
  $slots: {
    default(_: { num: number }): VNode[];
    foo(_: { str: string }): VNode[];
  };
};
</script>
