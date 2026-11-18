<script lang="ts">
import { type PropType, defineComponent } from 'vue';

export default defineComponent({
  props: {
    size: { type: String as PropType<'xl' | 'md' | 'xs'>, default: 'md' },
    count: { type: Number as PropType<3 | 1 | 2> },
  },
});
</script>

<template><i /></template>
