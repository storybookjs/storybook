import type { Channel } from 'storybook/internal/channels';
import { logger } from 'storybook/internal/node-logger';
import type { StoryIndex } from 'storybook/internal/types';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearRegistry } from '../../shared/open-service/server.ts';
import { registerReviewService } from '../../shared/open-service/services/review/server.ts';
import { REVIEW_EVENTS } from '../../shared/review/events.ts';
import type { ReviewState } from '../../shared/review/review-state.ts';
import { initReviewChannel } from './review-channel.ts';

vi.mock('storybook/internal/node-logger', { spy: true });

function createMockChannel() {
  type Listener = (...args: unknown[]) => unknown;
  const listeners = new Map<string, Listener[]>();
  const emitted: Array<{ event: string; payload: unknown }> = [];
  const channel = {
    on: vi.fn((event: string, listener: Listener) => {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
    }),
    off: vi.fn((event: string, listener: Listener) => {
      listeners.set(
        event,
        (listeners.get(event) ?? []).filter((candidate) => candidate !== listener)
      );
    }),
    emit: vi.fn((event: string, payload?: unknown) => {
      emitted.push({ event, payload });
    }),
    fire: async (event: string, ...args: unknown[]) => {
      for (const listener of listeners.get(event) ?? []) {
        await listener(...args);
      }
    },
  } as unknown as Channel & {
    fire: (event: string, ...args: unknown[]) => Promise<void>;
  };
  return { channel, emitted };
}

const sampleReview: ReviewState = {
  title: 'Recolour the primary button',
  description: 'Button background changed from blue to green.',
  collections: [
    {
      title: 'Button',
      rationale: 'The directly changed component.',
      storyIds: ['button--primary'],
    },
  ],
};

const index = {
  v: 5,
  entries: {
    'button--primary': {
      type: 'story',
      subtype: 'story',
      id: 'button--primary',
      name: 'Primary',
      title: 'Button',
      importPath: './src/Button.stories.tsx',
      tags: ['story'],
    },
  },
} as StoryIndex;

describe('initReviewChannel', () => {
  const NOW = new Date().getTime();
  const teardowns: Array<() => void> = [];
  const getIndex = vi.fn<() => Promise<StoryIndex>>();
  const registerService = () =>
    registerReviewService({ getIndex, subscribeToModuleGraphChanges: () => () => {} });
  const initializeReviewChannel = (channel: Channel) => {
    const teardown = initReviewChannel(channel);
    teardowns.push(teardown);
    return teardown;
  };

  beforeEach(() => {
    teardowns.length = 0;
    clearRegistry();
    getIndex.mockResolvedValue(index);
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => {
    teardowns.forEach((teardown) => teardown());
    clearRegistry();
    vi.restoreAllMocks();
  });

  it('adapts legacy PUSH_REVIEW into authoritative review state', async () => {
    const service = registerService();
    const { channel, emitted } = createMockChannel();

    initializeReviewChannel(channel);
    await channel.fire(REVIEW_EVENTS.PUSH_REVIEW, { ...sampleReview, stale: true });

    expect(service.queries.current.get(undefined)).toEqual({
      ...sampleReview,
      createdAt: NOW,
    });
    expect(emitted).toEqual([]);
  });

  it('logs and keeps state unchanged when a pushed review is invalid', async () => {
    const service = registerService();
    const { channel } = createMockChannel();

    initializeReviewChannel(channel);
    await channel.fire(REVIEW_EVENTS.PUSH_REVIEW, {
      ...sampleReview,
      collections: [{ ...sampleReview.collections[0], storyIds: ['missing--story'] }],
    });

    await vi.waitFor(() => {
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to apply PUSH_REVIEW payload')
      );
    });
    expect(service.queries.current.get(undefined)).toBeNull();
  });

  it('keeps only the legacy push listener', () => {
    registerService();
    const { channel } = createMockChannel();

    initializeReviewChannel(channel);

    expect(channel.on).toHaveBeenCalledWith(REVIEW_EVENTS.PUSH_REVIEW, expect.any(Function));
    expect(channel.on).toHaveBeenCalledTimes(1);
  });

  it('tears down the channel listener', () => {
    registerService();
    const { channel } = createMockChannel();

    const teardown = initializeReviewChannel(channel);
    teardown();
    teardowns.pop();

    expect(channel.off).toHaveBeenCalledWith(REVIEW_EVENTS.PUSH_REVIEW, expect.any(Function));
    expect(channel.off).toHaveBeenCalledTimes(1);
  });
});
