import type { Storybook } from '@storybook/core';
import type { Channel } from '@storybook/core/internal/channels';

import { initAIAnalyticsChannel } from './ai-setup-channel.ts';
import { initGhostStoriesChannel } from './ghost-stories-channel.ts';

/** Answer the checklist's ghost-stories and AI-setup scoring requests with this addon's Vitest. */
export function wireAiScoringChannels(
  storybook: Pick<Storybook, 'configDir' | 'hasPlugin' | 'getStoryIndexGenerator'>,
  channel: Channel
): void {
  const options = {
    configDir: storybook.configDir,
    isReactStorybook: () => storybook.hasPlugin('@storybook/react'),
  };
  initGhostStoriesChannel(channel, options);
  initAIAnalyticsChannel(channel, options, () => storybook.getStoryIndexGenerator());
}
