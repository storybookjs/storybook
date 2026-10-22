import { experimental_rendersInFrame } from 'storybook/preview-api';
import type { PreparedStory } from 'storybook/internal/types';

/**
 * Whether a docs page renders the story inline, in the docs page's own document, rather than in an
 * iframe. `experimental_rendersInFrame` is the one place that decides it, which the frame pool of
 * `features.experimentalFramePool` follows too.
 */
export const rendersInline = (story: Pick<PreparedStory, 'parameters'>, inline?: boolean) =>
  !experimental_rendersInFrame(story.parameters, inline);
