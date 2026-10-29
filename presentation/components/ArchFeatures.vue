<script setup lang="ts">
import { computed } from 'vue'
import ArchChip from './arch/ArchChip.vue'
import { ARCH_PALETTE, type ArchKind } from './arch/palette.ts'

type GroupId = 'product' | 'core' | 'official'

interface Feature {
  name: string
  was: string
  now: string
  /** A hook starting with `~` is hidden by a feature flag. */
  hooks?: string[]
  note?: string
}

interface Group {
  id: GroupId
  kind: ArchKind
  title: string
  sub: string
  features: Feature[]
}

const props = withDefaults(defineProps<{ groups?: GroupId[] }>(), {
  groups: () => ['product', 'core', 'official'],
})

const ANNOTATIONS = 'preview:annotations:collect'
const CHANNEL = 'server:channel:ready'

const GROUPS: Group[] = [
  {
    id: 'product',
    kind: 'feature',
    title: 'Product built-ins',
    sub: 'now in storybook · src/features/',
    features: [
      { name: 'Actions', was: 'actions', now: 'actions', hooks: ['~manager · actions', ANNOTATIONS] },
      { name: 'Backgrounds', was: 'backgrounds', now: 'backgrounds', hooks: ['~manager · backgrounds', ANNOTATIONS] },
      { name: 'Controls', was: 'controls, core-server', now: 'controls + save-story', hooks: ['~manager · controls', CHANNEL] },
      { name: 'Highlight', was: 'highlight', now: 'highlight', hooks: [ANNOTATIONS] },
      { name: 'Measure', was: 'measure', now: 'measure', hooks: ['~manager · measure', ANNOTATIONS] },
      { name: 'Outline', was: 'outline', now: 'outline', hooks: ['~manager · outline', ANNOTATIONS] },
      { name: 'Viewport', was: 'viewport', now: 'viewport', hooks: ['~manager · viewport', ANNOTATIONS] },
      { name: 'Component testing', was: 'component-testing', now: 'component-testing', hooks: ['~manager · interactions', ANNOTATIONS] },
      { name: 'Toolbar', was: 'toolbar', now: 'toolbar', note: 'placeholder, no hooks yet' },
      { name: 'Components manifest', was: 'core-server (flag)', now: 'components-manifest', hooks: ['~server:app:extend', '~server:static-output:collect'] },
      { name: 'Review', was: 'shared', now: 'review', hooks: ['manager', 'core:services:register', CHANNEL] },
      { name: 'Checklist', was: 'core-server', now: 'checklist', hooks: [CHANNEL, 'core:instance:close'] },
      { name: "What's new", was: 'core-server', now: 'whats-new', hooks: [CHANNEL] },
      { name: 'Open in editor', was: 'core-server', now: 'open-in-editor', hooks: [CHANNEL] },
    ],
  },
  {
    id: 'core',
    kind: 'core',
    title: 'Core built-ins',
    sub: 'in @storybook/core; docgen, story docs and change detection also load in a core-only instance',
    features: [
      { name: 'Docgen', was: 'shared/open-service', now: 'same, now a plugin', hooks: ['manager', ANNOTATIONS] },
      { name: 'Story docs', was: 'shared/open-service', now: 'same, now a plugin', hooks: [ANNOTATIONS] },
      { name: 'Change detection', was: 'core-server', now: 'core/src/services/change-detection', hooks: ['core:instance:ready', 'core:preview-builder:ready', 'core:instance:close'] },
      { name: 'Test', was: 'test, instrumenter, mocking-utils', now: 'core/src/test', hooks: [ANNOTATIONS] },
      { name: 'Ghost stories', was: 'core-server', now: 'core/src/story-index/ghost-stories', hooks: [ANNOTATIONS] },
    ],
  },
  {
    id: 'official',
    kind: 'addon',
    title: 'Moved into official addons and packages',
    sub: '',
    features: [
      { name: 'Vitest server glue', was: 'core-server', now: 'addon-vitest/src/node', note: "ghost runs, AI setup, idle wait; addon-vitest's own setup" },
      { name: 'AI scoring', was: 'new', now: 'addon-vitest/src/node', note: "addon-vitest's own setup" },
      { name: 'Docs block components', was: 'code/addons/docs/src', now: '@storybook/ui components', note: 'shared UI, not a plugin' },
      { name: 'Tools client', was: 'cli', now: '@storybook/open-service', note: 'client of the toolset RPC' },
    ],
  },
]

const shown = computed((): Group[] => GROUPS.filter((group) => props.groups.includes(group.id)))
</script>

<template>
  <table class="feat">
    <thead>
      <tr>
        <th>Feature</th>
        <th>Was in <span class="feat__hint">code/core/src/</span></th>
        <th>Now in</th>
        <th>Contributes through <span class="feat__hint"><ArchChip dashed>dashed</ArchChip> = behind a feature flag</span></th>
      </tr>
    </thead>
    <tbody v-for="group in shown" :key="group.id">
      <tr class="feat__group">
        <td colspan="4" :style="{ '--arch-hue': ARCH_PALETTE[group.kind].color }">
          {{ group.title }} <span v-if="group.sub">{{ group.sub }}</span>
        </td>
      </tr>
      <tr v-for="feature in group.features" :key="feature.name">
        <th scope="row">{{ feature.name }}</th>
        <td><code>{{ feature.was }}</code></td>
        <td><code>{{ feature.now }}</code></td>
        <td>
          <span v-if="feature.note" class="feat__note">{{ feature.note }}</span>
          <span v-else class="feat__hooks">
            <ArchChip
              v-for="hook in feature.hooks"
              :key="hook"
              :dashed="hook.startsWith('~')"
            >{{ hook.replace(/^~/, '') }}</ArchChip>
          </span>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.feat {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--sb-font-sans);
  font-size: 12px;
  line-height: 1.3;
}
.feat th,
.feat td {
  padding: 2px 8px;
  border-top: 1px solid var(--sb-border);
  border-bottom: 0;
  text-align: left;
  vertical-align: middle;
}
.feat thead th {
  border-top: 0;
  color: var(--sb-text-muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.feat__hint {
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
}
.feat thead :deep(.arch-chip) {
  text-transform: none;
  letter-spacing: 0;
}
.feat tbody th {
  font-weight: 800;
  white-space: nowrap;
}
.feat code {
  white-space: nowrap;
  padding: 0;
  background: none;
  color: var(--sb-text);
  font-size: 11px;
}
.feat__group td {
  padding-top: 6px;
  padding-left: 8px;
  border-top: 0;
  border-left: 4px solid var(--arch-hue);
  font-size: 14px;
  font-weight: 900;
}
tbody + tbody .feat__group td {
  padding-top: 14px;
}
.feat__group span {
  margin-left: 6px;
  color: var(--sb-text-muted);
  font-size: 11px;
  font-weight: 400;
}
.feat__hooks {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px 4px;
}
.feat__note {
  color: var(--sb-text-muted);
  font-size: 11px;
}
</style>
