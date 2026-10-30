<script setup lang="ts">
import ArchBlock from './arch/ArchBlock.vue'
import ArchChip from './arch/ArchChip.vue'
import type { ArchKind } from './arch/palette.ts'

interface Step {
  title: string
  note: string
  line: string
}

interface Mount {
  mode: string
  kind: ArchKind
  callers: string
  steps: { text: string; hook?: boolean; pre?: string }[]
  end: string
}

const STEPS: Step[] = [
  { title: 'Load main.ts', note: 'loadMainConfig', line: ':259' },
  { title: 'Resolve plugins', note: 'framework → builder + renderer, built-ins, addons', line: ':263' },
  { title: 'Dedupe, order', note: 'kind + name; builder → renderer → framework → addon', line: ':292' },
  { title: 'Set up', note: 'legacy adapter only if needed, then setup(storybook)', line: ':311' },
  { title: 'Collect, ready', note: 'stories · indexers · docs · static dirs · annotations · features', line: ':344' },
]

const MOUNTS: Mount[] = [
  {
    mode: 'dev',
    kind: 'product',
    callers: 'storybook dev → buildDevStandalone',
    steps: [
      { text: 'attachServerTransport(storybook.channel)' },
      { text: 'server:channel:ready', hook: true },
      { text: 'server:app:extend', hook: true },
      { pre: 'manager.dev →', text: 'manager:entries:collect', hook: true },
      { text: 'builder.dev(storybook) · listen' },
    ],
    end: 'returns close() to the CLI',
  },
  {
    mode: 'build',
    kind: 'product',
    callers: 'storybook build → buildStaticStandalone',
    steps: [
      { pre: 'manager.build →', text: 'manager:entries:collect', hook: true },
      { text: 'server:static-output:collect', hook: true },
      { text: 'builder.build(storybook)' },
      { text: 'storybook.getStoryIndexGenerator() → index.json' },
    ],
    end: 'finally close()',
  },
  {
    mode: 'headless',
    kind: 'openService',
    callers: 'storybook index · tools · skills · vitest plugin',
    steps: [
      { text: 'storybook.getIndex()' },
      { text: 'storybook.services.get(…)' },
      { text: 'storybook.toolsets.values()' },
      { text: 'tools: attach a transport to a running dev server' },
    ],
    end: 'caller calls close()',
  },
]
</script>

<template>
  <div class="pa">
    <ArchBlock kind="core" class="pa__instance">
      <div class="pa__instance-head">
        <span class="pa__instance-title">createStorybook({ configDir, workingDir, mode })</span>
        <span class="pa__muted">instance/create-storybook.ts · same call for every command</span>
      </div>
      <div class="pa__steps">
        <template v-for="(step, index) in STEPS" :key="step.title">
          <div v-if="index > 0" class="pa__arrow">→</div>
          <div class="pa__step">
            <div class="pa__step-head">
              <span class="pa__title">{{ step.title }}</span>
              <span class="pa__muted">{{ step.line }}</span>
            </div>
            <span class="pa__muted">{{ step.note }}</span>
          </div>
        </template>
      </div>
      <div class="pa__hooks">
        <span class="pa__muted">registers typed hooks, no second preset pass:</span>
        <ArchChip kind="core">core:services:register</ArchChip>
        <ArchChip kind="core">preview:annotations:collect</ArchChip>
        <ArchChip kind="core">core:features:extend</ArchChip>
        <span class="pa__muted">→ phase ready,</span>
        <ArchChip kind="core">core:instance:ready</ArchChip>
      </div>
    </ArchBlock>

    <div class="pa__fork">
      <span v-for="mount in MOUNTS" :key="mount.mode">↓ mode: '{{ mount.mode }}'</span>
    </div>

    <div class="pa__mounts">
      <ArchBlock v-for="mount in MOUNTS" :key="mount.mode" :kind="mount.kind" :title="mount.mode" :tag="mount.callers">
        <ul class="pa__list">
          <li v-for="step in mount.steps" :key="step.text">
            <code v-if="step.pre">{{ step.pre }} </code>
            <ArchChip v-if="step.hook" kind="core">{{ step.text }}</ArchChip>
            <code v-else>{{ step.text }}</code>
          </li>
        </ul>
        <div class="pa__end">{{ mount.end }}</div>
      </ArchBlock>
    </div>

    <ArchBlock kind="core" class="pa__close">
      <span class="pa__title pa__close-title">close()</span>
      <span class="pa__muted">core:instance:close → registered cleanups (builder bail, index route, …) → service registry cleared · :222</span>
    </ArchBlock>
  </div>
</template>

<style scoped>
.pa {
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 100%;
  margin-top: 4px;
  font-family: var(--sb-font-sans);
  font-size: 12px;
  line-height: 1.3;
}
.pa code {
  padding: 0;
  background: none;
  color: var(--sb-text);
  font-size: 11px;
}
.pa__muted {
  color: var(--sb-text-muted);
  font-size: 11px;
}
.pa__title {
  font-size: 13px;
  font-weight: 800;
}
.pa__instance {
  padding: 6px 10px 8px;
}
.pa__instance-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 10px;
  margin-bottom: 5px;
}
.pa__instance-title {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 14px;
  font-weight: 900;
}
.pa__steps {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 14px minmax(0, 1fr) 14px minmax(0, 1fr) 14px minmax(0, 1fr) 14px minmax(0, 1fr);
  align-items: stretch;
}
.pa__step {
  padding: 3px 7px;
  border: 1px solid var(--sb-border);
  border-radius: var(--sb-radius);
  background: var(--sb-bg);
}
.pa__step-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 4px;
}
.pa__arrow {
  align-self: center;
  color: var(--sb-text-muted);
  text-align: center;
}
.pa__hooks {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  margin-top: 6px;
}
.pa__fork {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  color: var(--sb-text-muted);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 11px;
  text-align: center;
}
.pa__mounts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.pa__list {
  margin: 2px 0 0;
  padding: 0;
  list-style: none;
}
.pa__list li {
  margin: 0;
  padding: 1px 0;
  line-height: 1.35;
}
.pa__end {
  margin-top: 3px;
  color: var(--sb-text-muted);
  font-size: 11px;
  font-style: italic;
}
.pa__close-title {
  margin-right: 10px;
}
</style>
