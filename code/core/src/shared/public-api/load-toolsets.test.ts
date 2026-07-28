import { describe, expect, it, vi } from 'vitest';
import * as v from 'valibot';

import { defineToolset, type AnyToolsetDefinition } from './definition.ts';
import { loadToolsets, type ToolsetPresets } from './load-toolsets.ts';

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
    const apply = vi.fn(
      async <T>(_ext: string, config?: T): Promise<T> =>
        [...((config as AnyToolsetDefinition[] | undefined) ?? []), fromAddon] as T
    ) as ToolsetPresets['apply'];

    await expect(loadToolsets({ apply }, [docs])).resolves.toEqual([docs, fromAddon]);
    expect(apply).toHaveBeenCalledWith('experimental_toolsets', [docs]);
  });
});
