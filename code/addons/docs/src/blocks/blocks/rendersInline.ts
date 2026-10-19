import type { PreparedStory } from 'storybook/internal/types';

/**
 * Whether a docs page renders the story inline, in the docs page's own document, rather than in an
 * iframe: the block's `inline` prop, else `parameters.docs.story.inline`.
 */
export const rendersInline = (story: Pick<PreparedStory, 'parameters'>, inline?: boolean) =>
  inline ?? (story.parameters?.docs?.story?.inline as boolean | undefined) ?? false;
