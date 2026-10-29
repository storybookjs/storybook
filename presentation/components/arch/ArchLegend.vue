<script setup lang="ts">
import { ARCH_PALETTE } from './palette.ts'
</script>

<template>
  <div class="arch-legend">
    <span v-for="(hue, kind) in ARCH_PALETTE" :key="kind" class="arch-legend__item">
      <i class="arch-legend__swatch" :style="{ background: hue.color }" />
      {{ hue.label }}
    </span>
  </div>
</template>

<style scoped>
.arch-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  color: var(--sb-text-muted);
  font-family: var(--sb-font-sans);
  font-size: 11px;
}
.arch-legend__item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.arch-legend__swatch {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}
</style>
