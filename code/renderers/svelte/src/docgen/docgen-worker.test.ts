// @vitest-environment node
import type { DocgenPayload, DocgenProvider, IndexEntry } from 'storybook/internal/types';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildDocgenPayload } from './component-docgen/build-docgen.ts';
import { createDocgenProvider } from './docgen-worker.ts';

vi.mock('./component-docgen/build-docgen.ts', { spy: true });

const DOWNSTREAM: DocgenPayload = {
  id: 'button',
  name: 'Downstream',
  path: './Button.stories.svelte',
  description: 'From downstream',
  jsDocTags: {},
};

const entryFor = (importPath: string): IndexEntry => ({
  id: 'button--primary',
  name: 'Primary',
  title: 'Button',
  type: 'story',
  subtype: 'story',
  importPath,
});

const fulfilled = (value: DocgenPayload | undefined) => ({ status: 'fulfilled' as const, value });

const downstream: DocgenProvider = async (inputs) => inputs.map(() => fulfilled(DOWNSTREAM));

describe('createDocgenProvider', () => {
  beforeEach(() => {
    vi.mocked(buildDocgenPayload).mockReset().mockResolvedValue(undefined);
  });
  it.each([
    { importPath: './Button.stories.svelte', extracts: true },
    { importPath: './Button.svelte', extracts: false },
    { importPath: './Button.stories.ts', extracts: true },
    { importPath: './Button.stories.js', extracts: true },
  ])('$importPath is extracted: $extracts', async ({ importPath, extracts }) => {
    const provider = createDocgenProvider()(downstream);

    await expect(provider([{ entry: entryFor(importPath) }])).resolves.toEqual([
      fulfilled(DOWNSTREAM),
    ]);
    expect(buildDocgenPayload).toHaveBeenCalledTimes(extracts ? 1 : 0);
  });
  it.each(['./Button.stories.svelte', './Button.stories.ts', './Button.stories.js'])(
    'merges extracted documentation over downstream for %s',
    async (importPath) => {
      const extracted: DocgenPayload = {
        id: 'button',
        name: 'Button',
        path: importPath,
        jsDocTags: {},
        argTypes: { label: { name: 'label', type: { name: 'string' } } },
      };
      vi.mocked(buildDocgenPayload).mockResolvedValueOnce(extracted);
      const provider = createDocgenProvider()(downstream);

      await expect(provider([{ entry: entryFor(importPath) }])).resolves.toEqual([
        fulfilled({ ...DOWNSTREAM, ...extracted }),
      ]);
    }
  );
});
