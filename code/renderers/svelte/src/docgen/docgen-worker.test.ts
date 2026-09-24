// @vitest-environment node
import type { DocgenPayload, IndexEntry } from 'storybook/internal/types';

import { describe, expect, it, vi } from 'vitest';

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

describe('createDocgenProvider', () => {
  it.each([
    { importPath: './Button.stories.svelte', extracts: true },
    { importPath: './Button.stories.ts', extracts: true },
    { importPath: './Button.story.js', extracts: true },
    { importPath: './Button.svelte', extracts: false },
  ])('$importPath is extracted: $extracts', async ({ importPath, extracts }) => {
    const provider = createDocgenProvider()(async () => DOWNSTREAM);

    await expect(provider({ entry: entryFor(importPath) })).resolves.toBe(DOWNSTREAM);
    expect(buildDocgenPayload).toHaveBeenCalledTimes(extracts ? 1 : 0);
  });

  it('merges its payload over downstream', async () => {
    vi.mocked(buildDocgenPayload).mockReturnValueOnce({
      id: 'button',
      name: 'Button',
      path: './Button.stories.svelte',
      jsDocTags: {},
      renderer: 'svelte',
    });
    const provider = createDocgenProvider()(async () => DOWNSTREAM);

    await expect(provider({ entry: entryFor('./Button.stories.svelte') })).resolves.toEqual({
      id: 'button',
      name: 'Button',
      path: './Button.stories.svelte',
      description: 'From downstream',
      jsDocTags: {},
      renderer: 'svelte',
    });
  });
});
