<script setup lang="ts">
import ArchChip from './arch/ArchChip.vue'

type Mark = 'instance' | 'mount' | 'close'

interface Step {
  title: string
  code: string[]
  mark?: Mark
  /** Note hanging under the step. */
  note?: string
}

interface ModeRow {
  mode: string
  callers: string
  text: string
}

const STEPS: Step[] = [
  { title: 'Any caller', code: ['createStorybook'], note: 'same call for every command' },
  { title: 'Load main.ts', code: ['loadMainConfig'], mark: 'instance' },
  { title: 'Resolve addons', code: ['[a11y()]'], mark: 'instance', note: 'imports, deduped, ordered' },
  { title: 'Set up', code: ['setup()'], mark: 'instance', note: 'each addon once, typed hooks' },
  { title: 'Ready', code: ['instance:ready'], mark: 'instance', note: 'stories, indexers, features collected' },
  { title: 'Mount', code: ["mode: '…'"], mark: 'mount', note: "the builder's dev() or build()" },
  { title: 'Close', code: ['close()'], mark: 'close', note: 'cleanups run, nothing global left' },
]

const MODES: ModeRow[] = [
  { mode: 'dev', callers: 'storybook dev', text: 'server:app:extend, builder.dev, listen; the CLI holds close()' },
  { mode: 'build', callers: 'storybook build', text: 'manager + builder.build, index.json; then close()' },
  { mode: 'headless', callers: 'index · tools · vitest', text: 'getIndex(), services, toolsets; the caller closes it' },
]
</script>

<template>
  <div class="pf">
    <div class="pf__once">one instance, every addon loaded once</div>

    <div class="pf__flow">
      <div
        v-for="(step, index) in STEPS"
        :key="step.title"
        class="pf__step"
        :class="step.mark && `pf__step--${step.mark}`"
      >
        <span class="pf__num">{{ index + 1 }}</span>
        <span class="pf__title">{{ step.title }}</span>
        <code v-for="line in step.code" :key="line">{{ line }}</code>
        <span v-if="step.note" class="pf__note">{{ step.note }}</span>
      </div>
    </div>

    <div class="pf__modes">
      <div v-for="row in MODES" :key="row.mode" class="pf__mode">
        <span class="pf__mode-name">{{ row.mode }}</span>
        <code>{{ row.callers }}</code>
        <span class="pf__mode-text">{{ row.text }}</span>
      </div>
    </div>

    <div class="pf__foot">
      <ArchChip kind="core">createStorybook</ArchChip> one instance per call
      <ArchChip kind="manager">mode</ArchChip> only the mount differs
      <ArchChip kind="feature">close()</ArchChip> no process-wide state
    </div>
  </div>
</template>

<style scoped>
.pf {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  margin-top: 12px;
  font-family: var(--sb-font-sans);
  font-size: 15px;
  line-height: 1.3;
}
.pf code {
  padding: 0;
  background: none;
  color: var(--sb-text);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 10.5px;
  white-space: nowrap;
}
/* Bracket over steps 2 to 5: 7 columns, 18px gaps. */
.pf__once {
  margin-left: calc((100% - 6 * 18px) / 7 + 18px);
  width: calc((100% - 6 * 18px) / 7 * 4 + 3 * 18px);
  height: 26px;
  padding-top: 2px;
  border: 2px solid var(--sb-blue-500);
  border-bottom: none;
  border-radius: 10px 10px 0 0;
  color: var(--sb-blue-500);
  font-size: 13px;
  font-weight: 800;
  text-align: center;
}
.pf__flow {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 18px;
  margin-top: -10px;
}
.pf__step {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 160px;
  padding: 10px 7px;
  border: 1.5px solid var(--sb-border);
  border-radius: var(--sb-radius);
  background: var(--sb-bg);
}
.pf__step:not(:last-child)::after {
  content: '→';
  position: absolute;
  top: 50%;
  right: -16px;
  transform: translateY(-50%);
  color: var(--sb-text-muted);
  font-size: 16px;
  font-weight: 900;
}
.pf__step--instance {
  --pf-hue: var(--sb-blue-500);
}
.pf__step--mount {
  --pf-hue: var(--sb-gold);
}
.pf__step--close {
  --pf-hue: var(--sb-green);
}
.pf__step[class*='pf__step--'] {
  border-color: var(--pf-hue);
  border-top: 4px solid var(--pf-hue);
  background: color-mix(in srgb, var(--pf-hue) 12%, var(--sb-bg));
}
.pf__num {
  color: var(--sb-text-muted);
  font-size: 12px;
  font-weight: 800;
}
.pf__title {
  font-size: 15px;
  font-weight: 800;
}
.pf__note {
  margin-top: auto;
  color: var(--sb-text-muted);
  font-size: 12px;
}
.pf__modes {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1.5px solid var(--sb-border);
}
.pf__mode {
  display: grid;
  grid-template-columns: 86px 190px 1fr;
  align-items: baseline;
  gap: 8px;
}
.pf__mode-name {
  font-size: 16px;
  font-weight: 900;
}
.pf__mode-text {
  color: var(--sb-text-muted);
}
.pf__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 8px;
  margin-top: 4px;
  color: var(--sb-text-muted);
  font-size: 12px;
}
</style>
