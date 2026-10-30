<script setup lang="ts">
import ArchBlock from './arch/ArchBlock.vue'
import type { ArchKind } from './arch/palette.ts'

interface HookRow {
  hook: string
  note: string
  output?: { kind: ArchKind; title: string }
}

/** Rows 1-4 hold the instance head and setup steps. */
const FIRST_HOOK_ROW = 5

const HOOKS: HookRow[] = [
  { hook: 'manager:entries:collect', note: 'one ESM build', output: { kind: 'manager', title: 'Manager bundle' } },
  { hook: 'preview:annotations:collect', note: 'also portable stories', output: { kind: 'core', title: 'Preview annotations' } },
  { hook: 'server:app:extend', note: 'e.g. components manifest', output: { kind: 'product', title: 'Dev server routes' } },
  { hook: 'server:static-output:collect', note: 'writers get the output dir', output: { kind: 'product', title: 'Static build files' } },
  { hook: 'core:services:register', note: 'toolset RPC for tools and MCP', output: { kind: 'openService', title: 'Services and toolsets' } },
  { hook: 'core:features:extend', note: 'flags, read when collected' },
]

const OWNED_ROW = FIRST_HOOK_ROW + HOOKS.length
</script>

<template>
  <div class="rt">
    <div class="rt__plugins">
      <div class="rt__col-head">Addons</div>
      <div class="rt__plain">
        <div class="rt__title">main.ts</div>
        <code>defineMain({ framework, addons })</code>
      </div>
      <ArchBlock kind="addon" title="Framework, renderer, builder">
        <span class="rt__note">defineFramework · defineRenderer · defineBuilder</span>
      </ArchBlock>
      <ArchBlock kind="feature" title="Product built-ins">
        <span class="rt__note">14 feature addons from storybook</span>
      </ArchBlock>
      <ArchBlock kind="core" title="Core built-ins">
        <span class="rt__note">docgen · story docs · change detection · test · ghost stories</span>
      </ArchBlock>
      <ArchBlock kind="addon" title="Addons">
        <code>defineAddon(() => ({ setup }))</code>
      </ArchBlock>
      <ArchBlock kind="addon" dashed title="Legacy presets">
        <span class="rt__note">third-party only, through the compat adapter</span>
      </ArchBlock>
    </div>

    <div class="rt__gutter">→</div>

    <div class="rt__main">
      <ArchBlock kind="core" class="rt__frame" :style="{ gridRow: `1 / ${OWNED_ROW + 1}` }" />
      <div class="rt__instance-head" style="grid-row: 1">
        <span class="rt__instance-title">Storybook instance</span>
        <code>createStorybook({ configDir, mode })</code>
      </div>
      <div class="rt__col-head rt__outputs-head">Outputs</div>

      <div class="rt__step" style="grid-row: 2">
        <span class="rt__title">Resolve addons</span>
        <span class="rt__note">dedupe by kind + name; first options win, with a warning</span>
      </div>
      <div class="rt__step" style="grid-row: 3">
        <span class="rt__title">Set up each addon</span>
        <span class="rt__note"><code>setup(storybook)</code> registers hooks; no <code>presets.apply</code></span>
      </div>
      <div class="rt__hooks-head" style="grid-row: 4">Hooks the product collects</div>

      <template v-for="(row, index) in HOOKS" :key="row.hook">
        <div class="rt__hook" :style="{ gridRow: FIRST_HOOK_ROW + index }">
          <code>{{ row.hook }}</code>
          <span class="rt__note">{{ row.note }}</span>
        </div>
        <template v-if="row.output">
          <div class="rt__arrow" :style="{ gridRow: FIRST_HOOK_ROW + index }">→</div>
          <ArchBlock :kind="row.output.kind" :title="row.output.title" class="rt__output" :style="{ gridRow: FIRST_HOOK_ROW + index }" />
        </template>
      </template>

      <div class="rt__step rt__owned" :style="{ gridRow: OWNED_ROW }">
        <span class="rt__title">Owned by the instance, disposed on close</span>
        <span class="rt__note">status and test-provider stores · services · channel · story index generator · toolset registry · project root</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rt {
  display: grid;
  margin-top: 6px;
  grid-template-columns: 250px 22px minmax(0, 1fr);
  align-items: center;
  width: 100%;
  font-family: var(--sb-font-sans);
  font-size: 12px;
  line-height: 1.35;
}
.rt code {
  padding: 0;
  background: none;
  color: var(--sb-text-muted);
  font-size: 11px;
}
.rt__plugins {
  display: flex;
  flex-direction: column;
  gap: 5px;
  align-self: start;
}
.rt__plugins :deep(.arch-block) {
  padding: 4px 9px;
}
.rt__col-head {
  color: var(--sb-text-muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.rt__plain,
.rt__step {
  padding: 4px 9px;
  border: 1px solid var(--sb-border);
  border-radius: var(--sb-radius);
  background: var(--sb-bg);
}
.rt__title {
  font-size: 13px;
  font-weight: 800;
}
.rt__note {
  color: var(--sb-text-muted);
  font-size: 11px;
}
.rt__gutter,
.rt__arrow {
  color: var(--sb-text-muted);
  font-size: 16px;
  text-align: center;
}
.rt__main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 22px 190px;
  grid-auto-rows: auto;
  row-gap: 4px;
  align-items: center;
}
.rt__frame {
  grid-column: 1;
  align-self: stretch;
}
.rt__main > :not(.rt__frame, .rt__arrow, .rt__output, .rt__outputs-head) {
  grid-column: 1;
  margin-inline: 12px;
  position: relative;
}
.rt__instance-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 10px;
  padding-top: 6px;
}
.rt__instance-title {
  font-size: 16px;
  font-weight: 900;
}
.rt__outputs-head {
  grid-column: 3;
  grid-row: 1;
  align-self: end;
}
.rt__step {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 8px;
}
.rt__hooks-head {
  margin-top: 2px;
  font-size: 13px;
  font-weight: 800;
}
.rt__hook {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 0 2px 8px;
  border-left: 2px solid var(--sb-border);
}
.rt__hook code {
  color: var(--sb-text);
  font-size: 11.5px;
}
.rt__arrow {
  grid-column: 2;
}
.rt__output {
  grid-column: 3;
  padding: 3px 9px;
}
.rt__owned {
  margin-bottom: 10px;
  display: block;
}
.rt__owned .rt__title {
  display: block;
}
</style>
