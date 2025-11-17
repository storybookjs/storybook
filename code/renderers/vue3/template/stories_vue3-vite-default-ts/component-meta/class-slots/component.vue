<script lang="ts">
import type { SlotsType, VNode } from 'vue';

export default {
  slots: Object as SlotsType<{
    default: { num: number };
    foo: { str: string };
  }>,
};
</script>
