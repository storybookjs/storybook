import type { StoryDocsPayload, StoryDocsProviderInput } from 'storybook/internal/types';

// TODO: port addon-svelte-csf's snippet generation; `undefined` defers to the rest of the chain.
export async function buildStoryDocsPayload(
  _input: StoryDocsProviderInput
): Promise<StoryDocsPayload | undefined> {
  return undefined;
}
