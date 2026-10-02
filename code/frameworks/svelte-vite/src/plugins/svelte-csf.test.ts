import { describe, expect, it } from 'vitest';

import {
  SVELTE_CSF_RUNTIME_STORIES_IMPORT_SOURCE,
  svelteCsfRuntimeStoriesPath,
} from '@storybook/svelte/internal/svelte-csf/transform';

import { svelteCsf } from './svelte-csf.ts';

describe(svelteCsf.name, () => {
  it('resolves the runtime stories import to its file, and leaves other imports alone', async () => {
    const plugin = await svelteCsf();
    const resolveId = plugin.resolveId as (source: string) => string | undefined;

    expect(resolveId(SVELTE_CSF_RUNTIME_STORIES_IMPORT_SOURCE)).toBe(svelteCsfRuntimeStoriesPath);
    expect(resolveId('./Button.svelte')).toBeUndefined();
  });

  it('only transforms stories files', async () => {
    const plugin = await svelteCsf();
    const transform = plugin.transform as (code: string, id: string) => Promise<unknown>;

    await expect(
      transform('export default {}', '/project/src/Button.svelte')
    ).resolves.toBeUndefined();
  });
});
