import { SvelteCsfAddonInstalledError } from 'storybook/internal/server-errors';
import type { Indexer } from 'storybook/internal/types';
import { describe, expect, it } from 'vitest';

import { experimental_indexers } from './preset.ts';

const otherIndexer: Indexer = { test: /\.stories\.ts$/, createIndex: async () => [] };

describe('experimental_indexers', () => {
  it('adds the Svelte CSF indexer before the other indexers', async () => {
    const indexers = await experimental_indexers([otherIndexer], { presetsList: [] });

    expect(indexers).toHaveLength(2);
    expect(indexers[0].test.test('Button.stories.svelte')).toBe(true);
    expect(indexers[1]).toBe(otherIndexer);
  });

  it('fails when the old addon is installed', async () => {
    await expect(
      experimental_indexers([], {
        presetsList: [
          {
            name: '/project/node_modules/@storybook/addon-svelte-csf/dist/preset.js',
            options: {},
            preset: {},
          },
        ],
      })
    ).rejects.toThrow(SvelteCsfAddonInstalledError);
  });
});
