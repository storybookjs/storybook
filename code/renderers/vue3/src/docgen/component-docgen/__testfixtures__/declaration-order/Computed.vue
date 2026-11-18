<script setup lang="ts">
import type { Tone } from './tone';

type Side = 'top' | 'bottom';
const sizes = { md: 1, xl: 2, sm: 3 } as const;
const tones = ['quiet', 'loud'] as const;

defineProps<{
  size?: keyof typeof sizes;
  tone?: (typeof tones)[number];
  placement?: Side | `${Side}-${'start' | 'end'}`;
  status?: Tone | 'custom';
}>();
</script>

<template><i /></template>
