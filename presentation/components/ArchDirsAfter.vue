<script setup lang="ts">
import { ARCH_PALETTE, type ArchKind } from './arch/palette.ts'

interface Pkg {
  kind: ArchKind
  path: string
  name: string
  dirs: [dir: string, desc: string, kind?: ArchKind][]
}

const COLUMNS: Pkg[][] = [
  [
    {
      kind: 'core',
      path: 'code/core',
      name: '@storybook/core',
      dirs: [
        ['src/instance', 'new: createStorybook, hooks, plugins, dedupe'],
        ['src/services', 'change-detection, core-owned stores'],
        ['src/story-index', 'from core-server: generator, ghost-stories, manifests'],
        ['src/test', 'instrumenter, mocking'],
        ['src/shared', 'open-service (docgen, story docs, toolsets), stores, review contract, toolbar and viewport types'],
        ['src/constants, utils', 'split out of shared'],
        ['src/preview-api, csf …', 'unchanged; portable stories became a factory'],
      ],
    },
    {
      kind: 'ui',
      path: 'code/lib/ui',
      name: '@storybook/ui',
      dirs: [
        ['src/components', 'from core components, manager, addon-docs'],
        ['src/theming', 'from core theming'],
      ],
    },
  ],
  [
    {
      kind: 'manager',
      path: 'code/lib/manager',
      name: '@storybook/manager',
      dirs: [
        ['src/ui', 'the manager app'],
        ['src/manager-api, router', 'from core'],
        ['src/builder-manager', 'one ESM build of all manager entries'],
        ['src/shared', 'checklist store, toolbar, viewport, docgen and review manager entries'],
      ],
    },
    {
      kind: 'product',
      path: 'code/lib/storybook',
      name: 'storybook',
      dirs: [
        ['src/storybook', 'cli, server, compat, preview, bin'],
        ['src/features', '14 built-in feature addons', 'feature'],
        ['src/shims', 'storybook/* entries re-exporting lower packages'],
        ['template, assets', 'from code/core'],
      ],
    },
    {
      kind: 'openService',
      path: 'code/lib/open-service',
      name: '@storybook/open-service',
      dirs: [['src', 'createTools, attached runtime, child host, instance discovery']],
    },
    {
      kind: 'addon',
      path: 'code/addons/vitest/src/node',
      name: 'addon-vitest',
      dirs: [['new files', 'ghost-stories channel, AI setup channel, wait-for-idle, AI scoring']],
    },
  ],
]
</script>

<template>
  <div class="after">
    <div v-for="(column, index) in COLUMNS" :key="index" class="after__col">
      <section v-for="pkg in column" :key="pkg.name" class="after__pkg">
        <div class="after__head" :style="{ '--arch-hue': ARCH_PALETTE[pkg.kind].color }">
          <span class="after__name">{{ pkg.name }}</span>
          <code>{{ pkg.path }}</code>
        </div>
        <div v-for="[dir, desc, kind] in pkg.dirs" :key="dir" class="after__row">
          <code class="after__dir" :style="kind ? { color: ARCH_PALETTE[kind].color } : undefined">{{ dir }}</code>
          <span class="after__desc">{{ desc }}</span>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.after {
  display: grid;
  margin-top: 8px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 24px;
  width: 100%;
  font-family: var(--sb-font-sans);
  font-size: 12px;
  line-height: 1.35;
}
.after code {
  padding: 0;
  background: none;
  font-size: 11px;
}
.after__col {
  display: grid;
  gap: 10px;
  align-content: start;
}
.after__head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding-left: 8px;
  border-left: 4px solid var(--arch-hue);
}
.after__name {
  color: var(--arch-hue);
  font-size: 14px;
  font-weight: 900;
}
.after__head code {
  color: var(--sb-text-muted);
}
.after__row {
  display: grid;
  grid-template-columns: 164px minmax(0, 1fr);
  gap: 8px;
  align-items: baseline;
  padding: 2px 0 2px 12px;
  border-top: 1px dashed var(--sb-border);
}
.after__head + .after__row {
  border-top: 0;
}
.after__dir {
  color: var(--sb-text);
}
.after__desc {
  color: var(--sb-text-muted);
}
</style>
