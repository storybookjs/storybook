import type { Indexer } from 'storybook/internal/types';
import { describe, expect, it } from 'vitest';

import { experimental_indexers } from './preset.ts';

const otherIndexer: Indexer = { test: /\.stories\.ts$/, createIndex: async () => [] };

describe('experimental_indexers', () => {
  it('adds the Svelte CSF indexer before the other indexers', async () => {
    const indexers = await experimental_indexers([otherIndexer]);

    expect(indexers).toHaveLength(2);
    expect(indexers[0].test.test('Button.stories.svelte')).toBe(true);
    expect(indexers[1]).toBe(otherIndexer);
  });
});
