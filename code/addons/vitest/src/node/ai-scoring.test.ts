import { describe, expect, it, vi } from 'vitest';

import { Channel } from '@storybook/core/internal/channels';

import { wireAiScoringChannels } from './ai-scoring.ts';
import { initAIAnalyticsChannel } from './ai-setup-channel.ts';
import { initGhostStoriesChannel } from './ghost-stories-channel.ts';

vi.mock('./ai-setup-channel.ts', () => ({ initAIAnalyticsChannel: vi.fn() }));
vi.mock('./ghost-stories-channel.ts', () => ({ initGhostStoriesChannel: vi.fn() }));

describe('wireAiScoringChannels', () => {
  it.each([
    { name: 'a React Storybook', addons: ['@storybook/react'], expected: true },
    { name: 'a Vue Storybook', addons: ['@storybook/vue3'], expected: false },
  ])('gates scoring by the renderer addon for $name', ({ addons, expected }) => {
    const channel = new Channel({});
    const generator = Promise.resolve({});
    const storybook = {
      configDir: '/project/.storybook',
      hasAddon: (name: string) => addons.includes(name),
      getStoryIndexGenerator: () => generator,
    };

    wireAiScoringChannels(storybook as never, channel);

    const [ghostChannel, ghostOptions] = vi.mocked(initGhostStoriesChannel).mock.lastCall!;
    const [aiChannel, aiOptions, getGenerator] = vi.mocked(initAIAnalyticsChannel).mock.lastCall!;
    expect([ghostChannel, aiChannel]).toEqual([channel, channel]);
    expect(ghostOptions.configDir).toBe('/project/.storybook');
    expect([ghostOptions.isReactStorybook(), aiOptions.isReactStorybook()]).toEqual([
      expected,
      expected,
    ]);
    expect(getGenerator?.()).toBe(generator);
  });
});
