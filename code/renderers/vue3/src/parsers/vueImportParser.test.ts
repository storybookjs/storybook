import { describe, expect, it, vi } from 'vitest';

import type { ImportEdge, ImportParserContext } from 'storybook/internal/core-server';
import { ChangeDetectionFailureError } from 'storybook/internal/core-server';

import { vueImportParser } from './vueImportParser.ts';

function makeContext(behavior: (source: string, virtualFilePath: string) => ImportEdge[]): {
  ctx: ImportParserContext;
  calls: { source: string; virtualFilePath: string }[];
} {
  const calls: { source: string; virtualFilePath: string }[] = [];
  const ctx: ImportParserContext = {
    parseScriptWithOxc: vi.fn(async (source: string, virtualFilePath: string) => {
      calls.push({ source, virtualFilePath });
      return behavior(source, virtualFilePath);
    }),
  };
  return { ctx, calls };
}

describe('vueImportParser', () => {
  it('claims the `.vue` extension', () => {
    expect(vueImportParser.extensions).toEqual(['.vue']);
  });

  it('extracts imports from <script lang="ts">', async () => {
    const source = [
      `<template>`,
      `  <div>{{ label }}</div>`,
      `</template>`,
      ``,
      `<script lang="ts">`,
      `import { defineComponent } from 'vue';`,
      `import type { PropType } from 'vue';`,
      ``,
      `export default defineComponent({`,
      `  props: { label: { type: String as PropType<string>, required: true } },`,
      `});`,
      `</script>`,
    ].join('\n');

    const { ctx, calls } = makeContext(() => [{ specifier: 'vue', kind: 'static' }]);

    const edges = await vueImportParser.parse({ filePath: '/tmp/Button.vue', source }, ctx);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.virtualFilePath).toBe('/tmp/Button.vue.script.ts');
    expect(calls[0]?.source).toContain(`import { defineComponent } from 'vue';`);
    expect(calls[0]?.source).toContain(`import type { PropType } from 'vue';`);
    expect(calls[0]?.source).not.toContain('<template>');
    expect(edges).toEqual([{ specifier: 'vue', kind: 'static' }]);
  });

  it('extracts imports from <script setup>', async () => {
    const source = [
      `<script setup>`,
      `import Button from './Button.vue';`,
      `import { ref } from 'vue';`,
      ``,
      `const open = ref(false);`,
      `</script>`,
      ``,
      `<template>`,
      `  <Button @click="open = !open" />`,
      `</template>`,
    ].join('\n');

    const { ctx, calls } = makeContext(() => [
      { specifier: './Button.vue', kind: 'static' },
      { specifier: 'vue', kind: 'static' },
    ]);

    const edges = await vueImportParser.parse({ filePath: '/tmp/App.vue', source }, ctx);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.virtualFilePath).toBe('/tmp/App.vue.script.js');
    expect(calls[0]?.source).toContain(`import Button from './Button.vue';`);
    expect(edges).toEqual([
      { specifier: './Button.vue', kind: 'static' },
      { specifier: 'vue', kind: 'static' },
    ]);
  });

  it('extracts imports from BOTH <script> and <script setup> and dedupes', async () => {
    const source = [
      `<script lang="ts">`,
      `import { defineOptions } from 'vue';`,
      `import SharedHelper from './shared.ts';`,
      `export default { name: 'Both' };`,
      `</script>`,
      ``,
      `<script setup lang="ts">`,
      `import SharedHelper from './shared.ts';`,
      `import Button from './Button.vue';`,
      `</script>`,
      ``,
      `<template><Button /></template>`,
    ].join('\n');

    const { ctx, calls } = makeContext((src) => {
      if (src.includes('defineOptions')) {
        return [
          { specifier: 'vue', kind: 'static' },
          { specifier: './shared.ts', kind: 'static' },
        ];
      }
      return [
        { specifier: './shared.ts', kind: 'static' },
        { specifier: './Button.vue', kind: 'static' },
      ];
    });

    const edges = await vueImportParser.parse({ filePath: '/tmp/Both.vue', source }, ctx);

    expect(calls).toHaveLength(2);
    expect(calls[0]?.virtualFilePath).toBe('/tmp/Both.vue.script.ts');
    expect(calls[1]?.virtualFilePath).toBe('/tmp/Both.vue.script.ts');
    expect(edges).toEqual([
      { specifier: 'vue', kind: 'static' },
      { specifier: './shared.ts', kind: 'static' },
      { specifier: './Button.vue', kind: 'static' },
    ]);
  });

  it('returns [] for a Vue file with only <template> and <style>', async () => {
    const source = [
      `<template>`,
      `  <div class="empty">no scripts here</div>`,
      `</template>`,
      ``,
      `<style scoped>`,
      `.empty { color: gray; }`,
      `</style>`,
    ].join('\n');

    const { ctx, calls } = makeContext(() => []);

    const edges = await vueImportParser.parse({ filePath: '/tmp/Empty.vue', source }, ctx);

    expect(calls).toHaveLength(0);
    expect(edges).toEqual([]);
  });

  it('uses .js virtual extension when lang is absent', async () => {
    const source = [
      `<script>`,
      `import { h } from 'vue';`,
      `export default { render: () => h('div') };`,
      `</script>`,
    ].join('\n');

    const { ctx, calls } = makeContext(() => [{ specifier: 'vue', kind: 'static' }]);

    await vueImportParser.parse({ filePath: '/tmp/Plain.vue', source }, ctx);

    expect(calls[0]?.virtualFilePath).toBe('/tmp/Plain.vue.script.js');
  });

  it('does NOT extract imports from <template> expressions', async () => {
    // Template imports (via `:is="SomeComponent"` or JSX-like expressions inside the
    // template) are out of scope. Only <script>/<script setup> should reach the oxc
    // wrapper — use a unique marker that only appears in the template and assert the
    // parsed script text never contains it.
    const source = [
      `<template>`,
      `  <component :is="TEMPLATE_ONLY_MARKER" />`,
      `  <span>some-template-only-literal</span>`,
      `</template>`,
      ``,
      `<script setup lang="ts">`,
      `import { ref } from 'vue';`,
      `const x = ref(null);`,
      `</script>`,
    ].join('\n');

    const { ctx, calls } = makeContext(() => [{ specifier: 'vue', kind: 'static' }]);

    await vueImportParser.parse({ filePath: '/tmp/TemplateOnly.vue', source }, ctx);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.source).toContain(`import { ref } from 'vue';`);
    expect(calls[0]?.source).not.toContain('TEMPLATE_ONLY_MARKER');
    expect(calls[0]?.source).not.toContain('some-template-only-literal');
  });

  it('surfaces a malformed .vue source as ChangeDetectionFailureError', async () => {
    // Unclosed <script> tag should produce a compiler error that we wrap.
    const source = [
      `<script setup lang="ts">`,
      `import { ref } from 'vue';`,
      `const open = ref(`,
    ].join('\n');

    const { ctx } = makeContext(() => []);

    await expect(
      vueImportParser.parse({ filePath: '/tmp/Broken.vue', source }, ctx)
    ).rejects.toBeInstanceOf(ChangeDetectionFailureError);
  });
});
