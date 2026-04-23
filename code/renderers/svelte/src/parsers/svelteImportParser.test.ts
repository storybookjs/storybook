import { describe, expect, it, vi } from 'vitest';

import type { ImportEdge, ImportParserContext } from 'storybook/internal/core-server';
import { ChangeDetectionFailureError } from 'storybook/internal/core-server';

import { svelteImportParser } from './svelteImportParser.ts';

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

describe('svelteImportParser', () => {
  it('claims the `.svelte` extension', () => {
    expect(svelteImportParser.extensions).toEqual(['.svelte']);
  });

  it('does NOT claim `.svelte.ts` / `.svelte.js` rune files (ParserRegistry routes those to oxc by last extension segment)', () => {
    // `path.extname('/tmp/Rune.svelte.ts')` returns `.ts`, so rune files fall through
    // to the built-in oxc parser. This assertion documents that contract: we must not
    // register `.svelte.ts` / `.svelte.js` here.
    expect(svelteImportParser.extensions).not.toContain('.svelte.ts');
    expect(svelteImportParser.extensions).not.toContain('.svelte.js');
  });

  it('extracts imports from a regular <script> block', async () => {
    const source = [
      `<script>`,
      `  import Button from './Button.svelte';`,
      `  import { onMount } from 'svelte';`,
      `</script>`,
      ``,
      `<div>hello</div>`,
    ].join('\n');

    const { ctx, calls } = makeContext((src) => {
      if (src.includes(`from './Button.svelte'`)) {
        return [
          { specifier: './Button.svelte', kind: 'static' },
          { specifier: 'svelte', kind: 'static' },
        ];
      }
      return [];
    });

    const edges = await svelteImportParser.parse({ filePath: '/tmp/Foo.svelte', source }, ctx);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.virtualFilePath).toBe('/tmp/Foo.svelte.script.ts');
    expect(calls[0]?.source).toContain(`import Button from './Button.svelte';`);
    expect(calls[0]?.source).toContain(`import { onMount } from 'svelte';`);
    expect(calls[0]?.source).not.toContain('<div>');
    expect(edges).toEqual([
      { specifier: './Button.svelte', kind: 'static' },
      { specifier: 'svelte', kind: 'static' },
    ]);
  });

  it('extracts imports from a <script module> block', async () => {
    const source = [
      `<script module>`,
      `  import { store } from './store.ts';`,
      `</script>`,
      ``,
      `<p>body</p>`,
    ].join('\n');

    const { ctx, calls } = makeContext((src) => {
      if (src.includes(`from './store.ts'`)) {
        return [{ specifier: './store.ts', kind: 'static' }];
      }
      return [];
    });

    const edges = await svelteImportParser.parse({ filePath: '/tmp/Bar.svelte', source }, ctx);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.virtualFilePath).toBe('/tmp/Bar.svelte.script.ts');
    expect(calls[0]?.source).toContain(`import { store } from './store.ts';`);
    expect(edges).toEqual([{ specifier: './store.ts', kind: 'static' }]);
  });

  it('extracts imports from BOTH instance and module scripts and dedupes', async () => {
    const source = [
      `<script module>`,
      `  import { shared } from './shared.ts';`,
      `  import Button from './Button.svelte';`,
      `</script>`,
      ``,
      `<script>`,
      `  import { onMount } from 'svelte';`,
      `  import Button from './Button.svelte';`,
      `</script>`,
      ``,
      `<div />`,
    ].join('\n');

    const { ctx, calls } = makeContext((src) => {
      if (src.includes(`from './shared.ts'`)) {
        return [
          { specifier: './shared.ts', kind: 'static' },
          { specifier: './Button.svelte', kind: 'static' },
        ];
      }
      return [
        { specifier: 'svelte', kind: 'static' },
        { specifier: './Button.svelte', kind: 'static' },
      ];
    });

    const edges = await svelteImportParser.parse({ filePath: '/tmp/Baz.svelte', source }, ctx);

    expect(calls).toHaveLength(2);
    expect(edges).toEqual([
      { specifier: './shared.ts', kind: 'static' },
      { specifier: './Button.svelte', kind: 'static' },
      { specifier: 'svelte', kind: 'static' },
    ]);
  });

  it('returns [] for a Svelte file with only markup and styles', async () => {
    const source = [
      `<div class="card">`,
      `  <p>No scripts here.</p>`,
      `</div>`,
      ``,
      `<style>`,
      `  .card { color: red; }`,
      `</style>`,
    ].join('\n');

    const { ctx, calls } = makeContext(() => []);

    const edges = await svelteImportParser.parse({ filePath: '/tmp/Empty.svelte', source }, ctx);

    expect(calls).toHaveLength(0);
    expect(edges).toEqual([]);
  });

  it('forwards type-only import filtering to parseScriptWithOxc (no special-casing)', async () => {
    // svelteImportParser does not know about type-only imports — that's oxc's job. We
    // assert here that the parser hands the script verbatim to parseScriptWithOxc and
    // returns exactly what oxc reports, so type-only filtering is preserved end to end.
    const source = [
      `<script lang="ts">`,
      `  import type { Writable } from 'svelte/store';`,
      `  import { writable } from 'svelte/store';`,
      `</script>`,
    ].join('\n');

    const { ctx, calls } = makeContext(() => [{ specifier: 'svelte/store', kind: 'static' }]);

    const edges = await svelteImportParser.parse({ filePath: '/tmp/Typed.svelte', source }, ctx);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.source).toContain(`import type { Writable } from 'svelte/store';`);
    expect(calls[0]?.source).toContain(`import { writable } from 'svelte/store';`);
    expect(edges).toEqual([{ specifier: 'svelte/store', kind: 'static' }]);
  });

  it('parses a .stories.svelte (Svelte CSF) file the same way', async () => {
    const source = [
      `<script module>`,
      `  import { defineMeta } from '@storybook/addon-svelte-csf';`,
      `  import Button from './Button.svelte';`,
      ``,
      `  const { Story } = defineMeta({ component: Button });`,
      `</script>`,
      ``,
      `<Story name="Primary" args={{}} />`,
    ].join('\n');

    const { ctx } = makeContext(() => [
      { specifier: '@storybook/addon-svelte-csf', kind: 'static' },
      { specifier: './Button.svelte', kind: 'static' },
    ]);

    const edges = await svelteImportParser.parse(
      { filePath: '/tmp/Button.stories.svelte', source },
      ctx
    );

    expect(edges).toEqual([
      { specifier: '@storybook/addon-svelte-csf', kind: 'static' },
      { specifier: './Button.svelte', kind: 'static' },
    ]);
  });

  it('surfaces a malformed .svelte source as ChangeDetectionFailureError', async () => {
    // Unclosed tag + bad expression — should cause svelte/compiler to throw.
    const source = `<script>\n  import x from 'y\n</script`;

    const { ctx } = makeContext(() => []);

    await expect(
      svelteImportParser.parse({ filePath: '/tmp/Broken.svelte', source }, ctx)
    ).rejects.toBeInstanceOf(ChangeDetectionFailureError);
  });
});
