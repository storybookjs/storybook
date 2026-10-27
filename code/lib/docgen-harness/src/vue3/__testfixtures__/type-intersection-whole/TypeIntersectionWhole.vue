<script setup lang="ts">
// Reproduces #30045: an intersection as the whole defineProps<> type argument
// yields no props at all - vue-docgen-api only handles TSTypeLiteral and
// TSTypeReference at that position, so the entire Props panel is empty.
import type { WithId } from './types.ts';

interface Sizeable {
  /** Size of the button. */
  size?: 'small' | 'medium' | 'large';
}

defineProps<WithId & Sizeable>();
</script>

<template>
  <button :data-id="id" :class="size"><slot /></button>
</template>
