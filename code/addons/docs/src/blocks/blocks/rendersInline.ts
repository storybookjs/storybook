import type { PreparedStory } from 'storybook/internal/types';

/**
 * Whether a docs page renders the story inline, in the docs page's own document, rather than in an
 * iframe: the block's `inline` prop, else `parameters.docs.story.inline`. A story that owns the
 * document (`layout: 'document'`) would own the docs page's too, so it always renders in an iframe.
 */
export const rendersInline = (story: Pick<PreparedStory, 'parameters'>, inline?: boolean) =>
  story.parameters?.layout !== 'document' &&
  (inline ?? (story.parameters?.docs?.story?.inline as boolean | undefined) ?? false);
