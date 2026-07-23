<script setup lang="ts">
import type { ChainedProps } from './types.ts';

interface LocalProps extends ChainedProps {
  /** Field declared directly on the component. */
  extra: boolean;
}

defineProps<LocalProps>();
</script>

<template>
  <span :data-id="id" :data-extra="extra">{{ name }}</span>
</template>
