import { describe, expect, it, vi } from 'vitest';

import type { Options, StoryDocsPayload, StoryDocsProviderInput } from 'storybook/internal/types';

import { experimental_storyDocsProvider } from './preset.ts';

const NEXT_PAYLOAD: StoryDocsPayload = {
  id: 'button',
  name: 'Button',
  path: './Button.stories.ts',
  stories: {},
};

function makeInput(importPath: string): StoryDocsProviderInput {
  return {
    entry: {
      id: 'button--primary',
      name: 'Primary',
      title: 'Forms/Button',
      type: 'story',
      subtype: 'story',
      importPath,
    },
  };
}

describe('vue3 experimental_storyDocsProvider', () => {
  it('passes through unchanged when the Vue docgen descriptor is absent', async (): Promise<void> => {
    const nextStoryDocs = vi.fn(async (): Promise<StoryDocsPayload> => NEXT_PAYLOAD);
    const options = {
      presets: {
        apply: vi.fn(async () => []),
      },
    } as unknown as Options;

    const provider = await experimental_storyDocsProvider(nextStoryDocs, options);

    expect(provider).toBe(nextStoryDocs);
    expect(await provider(makeInput('./Button.stories.ts'))).toBe(NEXT_PAYLOAD);
  });
});
