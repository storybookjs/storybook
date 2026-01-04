import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cache } from 'storybook/internal/common';
import {
  type RequestData,
  STORY_DISCOVERY_REQUEST,
  STORY_DISCOVERY_RESPONSE,
  type StoryDiscoveryRequestPayload,
} from 'storybook/internal/core-events';
import { getStorybookMetadata } from 'storybook/internal/telemetry';

import { generateSampledStories } from '../utils/story-generation';
import { initStoryDiscoveryChannel } from './story-discovery-channel';

vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/telemetry', { spy: true });
vi.mock('../utils/story-generation', { spy: true });

type Handler = (data: RequestData<StoryDiscoveryRequestPayload>) => Promise<void>;

const makeChannel = () => {
  const handlers = new Map<string, Handler>();
  const channel = {
    on: vi.fn((event: string, handler: Handler) => {
      handlers.set(event, handler);
      return channel;
    }),
    off: vi.fn(),
    emit: vi.fn(),
  } as any;

  return { channel, handlers };
};

describe('initStoryDiscoveryChannel eligibility gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cache.get).mockResolvedValue(undefined);
    vi.mocked(cache.set).mockResolvedValue(undefined as any);
    vi.mocked(getStorybookMetadata).mockResolvedValue({
      renderer: '@storybook/react',
      framework: { name: '@storybook/react-vite' },
      addons: {
        '@storybook/addon-vitest': { version: '0.0.0', options: {} },
      },
    } as any);

    // Make generation fail fast so the test never tries to execute Vitest.
    vi.mocked(generateSampledStories).mockResolvedValue({
      success: false,
      error: 'generation failed',
      generatedStories: [],
    } as any);
  });

  it('runs generation when eligible and not yet ran (and marks cache up-front)', async () => {
    const { channel, handlers } = makeChannel();
    initStoryDiscoveryChannel(channel, { configDir: '.storybook' } as any, {} as any);

    const handler = handlers.get(STORY_DISCOVERY_REQUEST)!;
    await handler({ id: 'req-1', payload: { sampleSize: 1 } });

    expect(cache.set).toHaveBeenCalledTimes(1);
    expect(vi.mocked(generateSampledStories)).toHaveBeenCalledTimes(1);
    expect(channel.emit).toHaveBeenCalledWith(
      STORY_DISCOVERY_RESPONSE,
      expect.objectContaining({ id: 'req-1', success: false })
    );
  });

  it('does not run if it already ran (short-circuits before reading metadata)', async () => {
    vi.mocked(cache.get).mockResolvedValueOnce({ timestamp: Date.now() } as any);

    const { channel, handlers } = makeChannel();
    initStoryDiscoveryChannel(channel, { configDir: '.storybook' } as any, {} as any);

    const handler = handlers.get(STORY_DISCOVERY_REQUEST)!;
    await handler({ id: 'req-2', payload: { sampleSize: 1 } });

    expect(vi.mocked(getStorybookMetadata)).not.toHaveBeenCalled();
    expect(vi.mocked(generateSampledStories)).not.toHaveBeenCalled();
    expect(channel.emit).toHaveBeenCalledWith(
      STORY_DISCOVERY_RESPONSE,
      expect.objectContaining({ id: 'req-2', success: false })
    );
  });

  it('does not run if renderer/framework is not React', async () => {
    vi.mocked(getStorybookMetadata).mockResolvedValueOnce({
      renderer: '@storybook/vue3',
      framework: { name: '@storybook/vue3-vite' },
      addons: { '@storybook/addon-vitest': { version: '0.0.0', options: {} } },
    } as any);

    const { channel, handlers } = makeChannel();
    initStoryDiscoveryChannel(channel, { configDir: '.storybook' } as any, {} as any);

    const handler = handlers.get(STORY_DISCOVERY_REQUEST)!;
    await handler({ id: 'req-3', payload: { sampleSize: 1 } });

    expect(vi.mocked(generateSampledStories)).not.toHaveBeenCalled();
    expect(channel.emit).toHaveBeenCalledWith(
      STORY_DISCOVERY_RESPONSE,
      expect.objectContaining({ id: 'req-3', success: false })
    );
  });

  it('does not run if @storybook/addon-vitest is not configured', async () => {
    vi.mocked(getStorybookMetadata).mockResolvedValueOnce({
      renderer: '@storybook/react',
      framework: { name: '@storybook/react-vite' },
      addons: {},
    } as any);

    const { channel, handlers } = makeChannel();
    initStoryDiscoveryChannel(channel, { configDir: '.storybook' } as any, {} as any);

    const handler = handlers.get(STORY_DISCOVERY_REQUEST)!;
    await handler({ id: 'req-4', payload: { sampleSize: 1 } });

    expect(vi.mocked(generateSampledStories)).not.toHaveBeenCalled();
    expect(channel.emit).toHaveBeenCalledWith(
      STORY_DISCOVERY_RESPONSE,
      expect.objectContaining({ id: 'req-4', success: false })
    );
  });
});
