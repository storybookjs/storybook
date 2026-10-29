<script setup lang="ts">
import { ARCH_PALETTE, type ArchKind } from './palette.ts'

const props = defineProps<{
  /** Omit for a neutral chip. */
  kind?: ArchKind
  dashed?: boolean
}>()
</script>

<template>
  <span
    class="arch-chip"
    :class="{ 'arch-chip--neutral': !props.kind, 'arch-chip--dashed': props.dashed }"
    :style="props.kind ? { '--arch-hue': ARCH_PALETTE[props.kind].color } : undefined"
  >
    <slot />
  </span>
</template>

<style scoped>
.arch-chip {
  display: inline-block;
  padding: 0 5px;
  border: 1px solid var(--arch-hue);
  border-radius: 3px;
  background: color-mix(in srgb, var(--arch-hue) 16%, var(--sb-bg));
  color: var(--sb-text);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 11px;
  line-height: 1.45;
  white-space: nowrap;
}
.arch-chip--neutral {
  border-color: var(--sb-border);
  background: none;
  color: var(--sb-text-muted);
}
.arch-chip--dashed {
  border-style: dashed;
}
</style>
