import { describe, expect, it } from 'vitest';

import {
  SVELTE_CSF_RUNTIME_STORIES_IMPORT_SOURCE,
  svelteCsfRuntimeStoriesPath,
} from '@storybook/svelte/internal/svelte-csf/transform';

import { svelteCsf } from './svelte-csf.ts';

describe(svelteCsf.name, () => {
  it('resolves the runtime stories import to its file, and leaves other imports alone', async () => {
    const { resolveId } = await svelteCsf();
    const { filter, handler } = resolveId as { filter: { id: RegExp }; handler: () => string };

    expect(filter.id.test(SVELTE_CSF_RUNTIME_STORIES_IMPORT_SOURCE)).toBe(true);
    expect(filter.id.test(`${SVELTE_CSF_RUNTIME_STORIES_IMPORT_SOURCE}.js`)).toBe(false);
    expect(filter.id.test('./Button.svelte')).toBe(false);
    expect(handler()).toBe(svelteCsfRuntimeStoriesPath);
  });

  it('only transforms stories files', async () => {
    const { transform } = await svelteCsf();
    const { filter } = transform as { filter: { id: RegExp } };

    expect(filter.id.test('/project/src/Button.stories.svelte')).toBe(true);
    expect(filter.id.test('/project/src/Button.svelte')).toBe(false);
    expect(filter.id.test('/project/src/Button.stories.svelte?svelte&type=style&lang.css')).toBe(
      false
    );
  });
});
