import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeEach, describe, it, vi } from 'vitest';

import { SVELTE_CSF_IMPORT_SOURCES } from '../constants.ts';

const loadSvelteConfig = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('@sveltejs/vite-plugin-svelte', () => ({ loadSvelteConfig }));

const currentDir = dirname(fileURLToPath(import.meta.url));
const storyFile = resolve(
  currentDir,
  '../../../template/stories/svelte-csf/templating.stories.svelte'
);

describe('parseForIndexer', () => {
  beforeEach(() => {
    // The config cache lives in module scope — reset modules so each test starts cold
    vi.resetModules();
    loadSvelteConfig.mockClear();
  });

  it('loads the Svelte config once across multiple story files', async ({ expect }) => {
    const { parseForIndexer } = await import('./parser.ts');
    const files = [
      storyFile,
      resolve(currentDir, '../../../template/stories/svelte-csf/test/identifiers.stories.svelte'),
    ];

    for (const file of files) {
      await parseForIndexer(file);
    }

    expect(loadSvelteConfig).toHaveBeenCalledTimes(1);
  });

  it('retries the Svelte config lookup after a failure instead of caching it', async ({
    expect,
  }) => {
    const { parseForIndexer } = await import('./parser.ts');
    loadSvelteConfig.mockRejectedValueOnce(new Error('broken config'));

    await expect(parseForIndexer(storyFile)).rejects.toThrow('broken config');
    await expect(parseForIndexer(storyFile)).resolves.toBeDefined();

    expect(loadSvelteConfig).toHaveBeenCalledTimes(2);
  });

  describe('imports', () => {
    async function writeStoriesFile(moduleScript: string) {
      const file = join(await mkdtemp(join(tmpdir(), 'svelte-csf-')), 'Example.stories.svelte');
      await writeFile(
        file,
        `<script module lang="ts">
          ${moduleScript}
        </script>

        <Story name="Default" />
        `
      );
      return file;
    }

    it.for(SVELTE_CSF_IMPORT_SOURCES)(
      'indexes a file that imports defineMeta from %s',
      async (source, { expect }) => {
        const { parseForIndexer } = await import('./parser.ts');
        const file = await writeStoriesFile(`
          import { defineMeta } from '${source}';
          const { Story } = defineMeta({ title: 'Example' });
        `);

        const { stories } = await parseForIndexer(file);

        expect(stories.map((story) => story.exportName)).toEqual(['Default']);
      }
    );

    it('indexes a file with type-only, other named and namespace imports', async ({ expect }) => {
      const { parseForIndexer } = await import('./parser.ts');
      const file = await writeStoriesFile(`
        import * as SB from '@storybook/svelte';
        import type { Meta } from '@storybook/svelte';
        import { composeStories, defineMeta } from '@storybook/svelte';
        const { Story } = defineMeta({ title: 'Example' });
      `);

      const { meta, stories } = await parseForIndexer(file);

      expect(meta.title).toBe('Example');
      expect(stories.map((story) => story.exportName)).toEqual(['Default']);
    });

    it('does not throw 0002 when defineMeta is imported by name next to a namespace import', async ({
      expect,
    }) => {
      const { parseForIndexer } = await import('./parser.ts');
      const file = await writeStoriesFile(`
        import * as SB from '@storybook/svelte';
        import { defineMeta } from '@storybook/svelte';
      `);

      await expect(parseForIndexer(file)).resolves.toBeDefined();
    });

    it('fails without a named defineMeta import', async ({ expect }) => {
      const { parseForIndexer } = await import('./parser.ts');
      const file = await writeStoriesFile(`
        import Button from './Button.svelte';
      `);

      await expect(parseForIndexer(file)).rejects.toThrow(
        'SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0003'
      );
    });

    it('fails with only a namespace import', async ({ expect }) => {
      const { parseForIndexer } = await import('./parser.ts');
      const file = await writeStoriesFile(`
        import * as SB from '@storybook/svelte';
        const { Story } = SB.defineMeta({ title: 'Example' });
      `);

      await expect(parseForIndexer(file)).rejects.toThrow(
        'SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0002'
      );
    });
  });
});
