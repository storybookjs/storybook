import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeEach, describe, it, vi } from 'vitest';

const loadSvelteConfig = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('@sveltejs/vite-plugin-svelte', () => ({ loadSvelteConfig }));

const currentDir = dirname(fileURLToPath(import.meta.url));
const storyFile = resolve(currentDir, '../__examples__/Button.stories.svelte');

describe('parseForIndexer', () => {
  beforeEach(() => {
    // The config cache lives in module scope — reset modules so each test starts cold
    vi.resetModules();
    loadSvelteConfig.mockClear();
  });

  it('loads the Svelte config once across multiple story files', async ({ expect }) => {
    const { parseForIndexer } = await import('./parser.ts');
    const files = [storyFile, resolve(currentDir, '../__examples__/ExportName.stories.svelte')];

    for (const file of files) {
      await parseForIndexer(file, { legacyTemplate: false });
    }

    expect(loadSvelteConfig).toHaveBeenCalledTimes(1);
  });

  it('retries the Svelte config lookup after a failure instead of caching it', async ({
    expect,
  }) => {
    const { parseForIndexer } = await import('./parser.ts');
    loadSvelteConfig.mockRejectedValueOnce(new Error('broken config'));

    await expect(parseForIndexer(storyFile, { legacyTemplate: false })).rejects.toThrow(
      'broken config'
    );
    await expect(parseForIndexer(storyFile, { legacyTemplate: false })).resolves.toBeDefined();

    expect(loadSvelteConfig).toHaveBeenCalledTimes(2);
  });

  it.for(['{null}', '{0}', '{false}'])(
    'treats a legacy <Meta title=%s /> as no title',
    async (value, { expect }) => {
      const { parseForIndexer } = await import('./parser.ts');
      const file = join(await mkdtemp(join(tmpdir(), 'svelte-csf-')), 'Legacy.stories.svelte');
      await writeFile(
        file,
        `<script context="module">
          import { Meta, Story } from '@storybook/svelte/csf';
        </script>

        <Meta title=${value} tags={['meta']} />

        <Story name="Default" />
        `
      );

      const { meta, stories } = await parseForIndexer(file, { legacyTemplate: true });

      expect(meta.title || undefined).toBeUndefined();
      expect(meta.tags).toEqual(['meta']);
      expect(stories.map((story) => story.exportName)).toEqual(['Default']);
    }
  );
});
