<script setup lang="ts">
import { ARCH_PALETTE, type ArchKind } from './palette.ts'

const props = defineProps<{
  kind: ArchKind
  title?: string
  tag?: string
  dashed?: boolean
}>()
</script>

<template>
  <div
    class="arch-block"
    :class="{ 'arch-block--dashed': props.dashed }"
    :style="{ '--arch-hue': ARCH_PALETTE[props.kind].color }"
  >
    <div v-if="props.title || props.tag" class="arch-block__head">
      <span v-if="props.title" class="arch-block__title">{{ props.title }}</span>
      <code v-if="props.tag" class="arch-block__tag">{{ props.tag }}</code>
    </div>
    <div v-if="$slots.default" class="arch-block__body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.arch-block {
  min-width: 0;
  padding: 6px 10px;
  border: 1px solid color-mix(in srgb, var(--arch-hue) 50%, transparent);
  border-left: 4px solid var(--arch-hue);
  border-radius: var(--sb-radius);
  background: color-mix(in srgb, var(--arch-hue) 14%, var(--sb-bg));
  color: var(--sb-text);
  font-family: var(--sb-font-sans);
  font-size: 12px;
  line-height: 1.35;
}
.arch-block--dashed {
  border: 1.5px dashed var(--arch-hue);
  background: color-mix(in srgb, var(--arch-hue) 6%, var(--sb-bg));
}
.arch-block__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
}
.arch-block__title {
  font-size: 13px;
  font-weight: 800;
}
.arch-block__tag,
.arch-block__body :deep(code) {
  padding: 0;
  background: none;
  color: var(--sb-text-muted);
  font-size: 11px;
}
.arch-block__body {
  margin-top: 2px;
}
.arch-block__head + .arch-block__body {
  margin-top: 3px;
}
</style>
