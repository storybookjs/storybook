import { describe, expect, it, vi } from 'vitest';
import * as v from 'valibot';

import { defineToolset } from './definition.ts';
import { loadToolsets } from './load-toolsets.ts';

const docs = defineToolset({
  id: 'docs',
  description: 'docs',
  methods: {
    list: {
      description: 'list',
      schema: v.object({}),
      handler: () => [],
    },
  },
});

const fromAddon = defineToolset({
  id: 'test',
  description: 'test',
  methods: {
    run: {
      description: 'run',
      schema: v.object({}),
      handler: () => ({ ok: true }),
    },
  },
});

describe('loadToolsets', () => {
  it('returns presets.apply experimental_toolsets with the given defaults', async () => {
    const apply = vi.fn(async (_ext: string, config: unknown) => [
      ...(config as (typeof docs)[]),
      fromAddon,
    ]);

    await expect(loadToolsets({ apply }, [docs])).resolves.toEqual([docs, fromAddon]);
    expect(apply).toHaveBeenCalledWith('experimental_toolsets', [docs]);
  });
});
