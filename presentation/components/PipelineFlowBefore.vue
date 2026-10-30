<script setup lang="ts">
import ArchChip from './arch/ArchChip.vue'

type Mark = 'pass' | 'apply' | 'global'

interface Step {
  title: string
  code: string[]
  mark?: Mark
  /** Note hanging under the step. */
  note?: string
}

interface ModeRow {
  mode: string
  fn: string
  text: string
}

const STEPS: Step[] = [
  { title: 'CLI flags', code: ['storybook dev'], note: 'flags become the options' },
  { title: 'Load main.ts', code: ['loadMainConfig'] },
  { title: 'Presets, pass 1', code: ['loadAllPresets'], mark: 'pass', note: 'framework presets only' },
  { title: 'Find the builder', code: ["apply('core')"], mark: 'apply', note: 'core.builder: a package name' },
  { title: 'Presets, pass 2', code: ['loadAllPresets'], mark: 'pass', note: 'all presets, again' },
  { title: 'Process state', code: ['setChannel', 'FEATURES'], mark: 'global', note: 'one per process' },
  { title: 'Mount', code: ['listen()'], mark: 'apply', note: "6 more apply('…')" },
]

const MODES: ModeRow[] = [
  { mode: 'dev', fn: 'buildDevStandalone', text: 'all seven steps, then listen; Ctrl-C exits the process' },
  { mode: 'build', fn: 'buildStaticStandalone', text: 'same steps; mount writes a static build' },
  { mode: 'headless', fn: 'loadStorybook', text: 'steps 2 to 6, returns the options; nothing to close' },
]
</script>

<template>
  <div class="pf">
    <div class="pf__twice">every preset, loaded twice</div>

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
        <code>{{ row.fn }}</code>
        <span class="pf__mode-text">{{ row.text }}</span>
      </div>
    </div>

    <div class="pf__foot">
      <ArchChip kind="product">loadAllPresets</ArchChip> twice per command
      <ArchChip kind="addon">apply('…')</ArchChip> string lookups
      <ArchChip kind="openService" dashed>global</ArchChip> process-wide state
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
  font-size: 11px;
  white-space: nowrap;
}
/* Bracket over steps 3 to 5: 7 columns, 18px gaps. */
.pf__twice {
  margin-left: calc((100% - 6 * 18px) / 7 * 2 + 2 * 18px);
  width: calc((100% - 6 * 18px) / 7 * 3 + 2 * 18px);
  height: 26px;
  padding-top: 2px;
  border: 2px solid var(--sb-pink);
  border-bottom: none;
  border-radius: 10px 10px 0 0;
  color: var(--sb-pink);
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
.pf__step--pass {
  --pf-hue: var(--sb-pink);
}
.pf__step--apply {
  --pf-hue: #f97316;
}
.pf__step--global {
  --pf-hue: #8b5cf6;
  border-style: dashed;
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
