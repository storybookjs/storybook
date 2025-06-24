<script lang="ts">
import { VNode } from 'vue';

export default {} as new () => {
  $slots: {
    default(_: { num: number }): VNode[];
    foo(_: { str: string }): VNode[];
  };
};
</script>
