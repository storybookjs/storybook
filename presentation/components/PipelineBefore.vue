<script setup lang="ts">
import ArchChip from './arch/ArchChip.vue'

type Mark = 'pass' | 'apply' | 'global'

interface Cell {
  text: string
  line?: string
  mark?: Mark
}

interface StageRow {
  stage: string
  pass?: boolean
  cells: [Cell, Cell, Cell]
}

const ENTRIES = [
  { mode: 'dev', file: 'core-server/build-dev.ts', fn: 'buildDevStandalone' },
  { mode: 'build', file: 'core-server/build-static.ts', fn: 'buildStaticStandalone' },
  { mode: 'headless', file: 'core-server/load.ts', fn: 'loadStorybook' },
]

const ROWS: StageRow[] = [
  {
    stage: 'Load main.ts',
    cells: [
      { text: 'loadMainConfig(options)', line: ':148' },
      { text: 'loadMainConfig(options)', line: ':56' },
      { text: 'loadMainConfig(options)', line: ':48' },
    ],
  },
  {
    stage: 'First channel',
    cells: [
      { text: "placeholder, 'NOT READY YET'", line: ':194' },
      { text: 'no-op new Channel({})', line: ':78' },
      { text: 'setChannel(channel)', line: ':46', mark: 'global' },
    ],
  },
  {
    stage: 'Presets pass 1',
    pass: true,
    cells: [
      { text: 'loadAllPresets(framework)', line: ':187', mark: 'pass' },
      { text: 'loadAllPresets(+ common)', line: ':79', mark: 'pass' },
      { text: 'loadAllPresets(framework)', line: ':63', mark: 'pass' },
    ],
  },
  {
    stage: 'Find the builder',
    cells: [
      { text: "apply('core')", line: ':204', mark: 'apply' },
      { text: "apply('core'), apply('build')", line: ':87', mark: 'apply' },
      { text: "apply('core')", line: ':73', mark: 'apply' },
    ],
  },
  {
    stage: 'Load builders',
    cells: [
      { text: 'get{Preview,Manager}Builder', line: ':223' },
      { text: 'getBuilders(…)', line: ':89' },
      { text: 'builder preset.js', line: ':83' },
    ],
  },
  {
    stage: 'Server channel',
    cells: [
      { text: 'getServerChannel → setChannel', line: ':251', mark: 'global' },
      { text: '—' },
      { text: '—' },
    ],
  },
  {
    stage: 'Presets pass 2',
    pass: true,
    cells: [
      { text: 'loadAllPresets(all)', line: ':261', mark: 'pass' },
      { text: 'loadAllPresets(all)', line: ':99', mark: 'pass' },
      { text: 'loadAllPresets(all)', line: ':98', mark: 'pass' },
    ],
  },
  {
    stage: 'Features',
    cells: [
      { text: 'global.FEATURES = apply(…)', line: ':277', mark: 'global' },
      { text: 'global.FEATURES = apply(…)', line: ':114', mark: 'global' },
      { text: 'global.FEATURES = apply(…)', line: ':111', mark: 'global' },
    ],
  },
  {
    stage: 'Mount',
    cells: [
      { text: 'storybookDevServer: 6 more apply(…), listen, SIGINT → exit', line: ':289', mark: 'apply' },
      { text: 'manager + preview build, index.json', line: ':141' },
      { text: 'return Options; never closed', line: ':116' },
    ],
  },
]
</script>

<template>
  <div class="pb">
    <div class="pb__corner">Stage</div>
    <div v-for="entry in ENTRIES" :key="entry.mode" class="pb__head">
      <span class="pb__mode">{{ entry.mode }}</span>
      <code>{{ entry.fn }}</code>
      <span class="pb__file">{{ entry.file }}</span>
    </div>

    <template v-for="row in ROWS" :key="row.stage">
      <div class="pb__stage" :class="{ 'pb__stage--pass': row.pass }">{{ row.stage }}</div>
      <div
        v-for="(cell, index) in row.cells"
        :key="index"
        class="pb__cell"
        :class="cell.mark && `pb__cell--${cell.mark}`"
      >
        <span class="pb__text">{{ cell.text }}</span>
        <span v-if="cell.line" class="pb__line">{{ cell.line }}</span>
      </div>
    </template>

    <div class="pb__foot">
      <ArchChip kind="product">loadAllPresets</ArchChip> twice per command: once to find the builder, once with it
      <ArchChip kind="addon">presets.apply('…')</ArchChip> string lookups, 9 on the dev entry
      <ArchChip kind="openService" dashed>global</ArchChip> process-wide state
    </div>
  </div>
</template>

<style scoped>
.pb {
  display: grid;
  grid-template-columns: 104px repeat(3, minmax(0, 1fr));
  gap: 3px 6px;
  width: 100%;
  margin-top: -4px;
  font-family: var(--sb-font-sans);
  font-size: 11.5px;
  line-height: 1.3;
}
.pb code {
  padding: 0;
  background: none;
  color: var(--sb-text);
  font-size: 11.5px;
}
.pb__corner,
.pb__head {
  padding-bottom: 1px;
  border-bottom: 1.5px solid var(--sb-border);
}
.pb__corner {
  align-self: end;
  color: var(--sb-text-muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.pb__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 6px;
}
.pb__mode {
  font-size: 14px;
  font-weight: 900;
}
.pb__file {
  color: var(--sb-text-muted);
  font-size: 11px;
}
.pb__stage {
  align-self: center;
  font-size: 12px;
  font-weight: 800;
}
.pb__stage--pass {
  color: var(--sb-pink);
}
.pb__cell {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 6px;
  padding: 1px 7px;
  border: 1px solid var(--sb-border);
  border-radius: var(--sb-radius);
  background: var(--sb-bg);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 11px;
}
.pb__cell--pass {
  --pb-hue: var(--sb-pink);
}
.pb__cell--apply {
  --pb-hue: #f97316;
}
.pb__cell--global {
  --pb-hue: #8b5cf6;
  border-style: dashed;
}
.pb__cell[class*='pb__cell--'] {
  border-color: var(--pb-hue);
  border-left: 4px solid var(--pb-hue);
  background: color-mix(in srgb, var(--pb-hue) 12%, var(--sb-bg));
}
.pb__line {
  flex: none;
  color: var(--sb-text-muted);
}
.pb__foot {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 8px;
  margin-top: 4px;
  color: var(--sb-text-muted);
  font-size: 11px;
}
</style>
