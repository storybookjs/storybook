<script setup lang="ts">
import ArchChip from './arch/ArchChip.vue'
import type { ArchKind } from './arch/palette.ts'

/** A chip without `kind` means the directory stays in core. */
type Dest = [label: string, kind?: ArchKind]

const DIRS: [dir: string, dests: Dest[]][] = [
  ['actions', [['features/actions 30', 'feature']]],
  ['backgrounds', [['features/backgrounds 9', 'feature']]],
  ['bin', [['storybook 4', 'product']]],
  ['builder-manager', [['builder-manager 7', 'manager']]],
  ['cli', [['storybook/cli 88', 'product'], ['open-service 31', 'openService'], ['core 3', 'core']]],
  ['common', [['stays'], ['storybook 10', 'product']]],
  ['component-testing', [['features/component-testing 28', 'feature']]],
  ['components', [['ui/components 157', 'ui']]],
  ['controls', [['features/controls 13', 'feature']]],
  ['core-server', [['story-index 88', 'core'], ['services 10', 'core'], ['common/utils 5', 'core'], ['storybook/server 55', 'product'], ['features 20', 'feature'], ['addon-vitest 6', 'addon']]],
  ['highlight', [['features/highlight 10', 'feature']]],
  ['instrumenter', [['test/instrumenter 8', 'core']]],
  ['manager', [['manager/ui 219', 'manager'], ['ui 6', 'ui']]],
  ['manager-api', [['manager-api 58', 'manager'], ['ui 3', 'ui']]],
  ['measure', [['features/measure 12', 'feature']]],
  ['mocking-utils', [['test/mocking 9', 'core']]],
  ['outline', [['features/outline 9', 'feature']]],
  ['preview', [['stays'], ['storybook 2', 'product']]],
  ['preview-api', [['stays'], ['addon-docs 1', 'addon']]],
  ['router', [['router 3', 'manager'], ['shared/router 2', 'core']]],
  ['shared', [['constants, utils 29', 'core'], ['features/review 4', 'feature'], ['manager/shared 4', 'manager'], ['ui 1', 'ui']]],
  ['test', [['stays'], ['features/actions 1', 'feature']]],
  ['theming', [['ui/theming 16', 'ui']]],
  ['toolbar', [['manager 6', 'manager'], ['shared, types 2', 'core'], ['features/toolbar 1', 'feature']]],
  ['viewport', [['shared/viewport 5', 'core'], ['features/viewport 3', 'feature'], ['manager 1', 'manager']]],
]

const STAY = ['channels', 'client-logger', 'node-logger', 'component-meta', 'core-events', 'csf', 'csf-tools', 'docs-tools', 'oxc-parser', 'telemetry', 'types']

const HALF = 12
const COLUMNS = [DIRS.slice(0, HALF), DIRS.slice(HALF)]
</script>

<template>
  <div class="dirs">
    <div class="dirs__cols">
      <div v-for="(column, index) in COLUMNS" :key="index" class="dirs__col">
        <div v-for="[dir, dests] in column" :key="dir" class="dirs__row">
          <code class="dirs__dir">{{ dir }}</code>
          <span class="dirs__chips">
            <ArchChip v-for="[label, kind] in dests" :key="label" :kind="kind">{{ label }}</ArchChip>
          </span>
        </div>
      </div>
    </div>
    <p class="dirs__footer">
      Outside <code>code/core/src</code>:
      <code>core/template</code> → <ArchChip kind="product">storybook/template 65</ArchChip>
      · <code>core/assets</code> → <ArchChip kind="product">storybook/assets 18</ArchChip> <ArchChip kind="manager">manager/assets 2</ArchChip>
      · <code>addons/docs/src</code> → <ArchChip kind="ui">ui/components 55</ArchChip>
      · <code>lib/core-webpack</code> → <ArchChip kind="addon">builder-webpack5 4</ArchChip>
    </p>
    <p class="dirs__footer">
      Each <code>code/core/src</code> directory → where its files went, with renamed-file counts from <code>git diff -M</code>.
      <ArchChip>stays</ArchChip> = left in core, as did {{ STAY.join(', ') }}.
    </p>
  </div>
</template>

<style scoped>
.dirs {
  display: grid;
  gap: 8px;
  width: 100%;
  font-family: var(--sb-font-sans);
  font-size: 12px;
}
.dirs code {
  padding: 0;
  background: none;
  color: var(--sb-text);
  font-size: 11px;
}
.dirs__footer {
  margin: 0;
  color: var(--sb-text-muted);
  font-size: 11.5px;
  line-height: 1.6;
}
.dirs__cols {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 20px;
}
.dirs__row {
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr);
  gap: 8px;
  align-items: baseline;
  padding: 1px 0;
  border-top: 1px dashed var(--sb-border);
}
.dirs__row:first-child {
  border-top: 0;
}
.dirs__dir {
  overflow-wrap: anywhere;
}
.dirs__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 4px;
}
</style>
