import type { Channel } from 'storybook/internal/channels';
import type { StoryIndex } from 'storybook/internal/types';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearRegistry } from '../../shared/open-service/server.ts';
import { registerReviewService } from '../../shared/open-service/services/review/server.ts';
import { REVIEW_EVENTS } from '../../shared/review/events.ts';
import type { ReviewState } from '../../shared/review/review-state.ts';
import { initReviewChannel } from './review-channel.ts';

function createMockSubscribe() {
  let captured: (() => void) | undefined;
  return {
    subscribeToModuleGraphChanges: vi.fn((onChange: () => void) => {
      captured = onChange;
      return () => {
        captured = undefined;
      };
    }),
    fireChange: () => captured?.(),
  };
}

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
  const initializeReviewChannel = (
    channel: Channel,
    options?: Parameters<typeof initReviewChannel>[1]
  ) => {
    const teardown = initReviewChannel(channel, options);
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

  it('adapts legacy PUSH_REVIEW into authoritative OSA state', async () => {
    const service = registerReviewService({ getIndex });
    const { channel, emitted } = createMockChannel();

    initializeReviewChannel(channel);
    await channel.fire(REVIEW_EVENTS.PUSH_REVIEW, { ...sampleReview, stale: true });

    expect(service.queries.current.get(undefined)).toEqual({
      ...sampleReview,
      createdAt: NOW,
    });
    expect(emitted).toEqual([]);
  });

  it('relays dismissal navigation without mutating OSA state again', async () => {
    const service = registerReviewService({ getIndex });
    const dismissReview = vi.spyOn(service.commands, 'dismissReview');
    const { channel, emitted } = createMockChannel();

    initializeReviewChannel(channel);
    await channel.fire(REVIEW_EVENTS.PUSH_REVIEW, sampleReview);
    dismissReview.mockClear();
    await channel.fire(REVIEW_EVENTS.DISMISS_REVIEW, '?path=/story/foo');

    expect(dismissReview).not.toHaveBeenCalled();
    expect(service.queries.current.get(undefined)).toEqual({
      ...sampleReview,
      createdAt: NOW,
    });
    expect(emitted).toEqual([
      { event: REVIEW_EVENTS.REVIEW_DISMISSED, payload: '?path=/story/foo' },
    ]);
  });

  it('keeps only the legacy push and dismissal listeners', () => {
    registerReviewService({ getIndex });
    const { channel } = createMockChannel();

    initializeReviewChannel(channel, {
      subscribeToModuleGraphChanges: vi.fn(() => () => {}),
    });

    expect(channel.on).toHaveBeenCalledWith(REVIEW_EVENTS.PUSH_REVIEW, expect.any(Function));
    expect(channel.on).toHaveBeenCalledWith(REVIEW_EVENTS.DISMISS_REVIEW, expect.any(Function));
    expect(channel.on).toHaveBeenCalledTimes(2);
  });

  it('marks OSA state stale after the grace window', async () => {
    const service = registerReviewService({ getIndex });
    const { channel } = createMockChannel();
    const { subscribeToModuleGraphChanges, fireChange } = createMockSubscribe();
    initializeReviewChannel(channel, { subscribeToModuleGraphChanges });
    await channel.fire(REVIEW_EVENTS.PUSH_REVIEW, sampleReview);

    vi.spyOn(Date, 'now').mockReturnValue(NOW + 12_000);
    fireChange();

    await vi.waitFor(() => {
      expect(service.queries.current.get(undefined)?.stale).toBe(true);
    });
  });

  it('does not mark OSA state stale inside the grace window', async () => {
    const service = registerReviewService({ getIndex });
    const markStale = vi.spyOn(service.commands, 'markStale');
    const { channel } = createMockChannel();
    const { subscribeToModuleGraphChanges, fireChange } = createMockSubscribe();
    initializeReviewChannel(channel, { subscribeToModuleGraphChanges });
    await channel.fire(REVIEW_EVENTS.PUSH_REVIEW, sampleReview);

    fireChange();

    expect(markStale).not.toHaveBeenCalled();
    expect(service.queries.current.get(undefined)?.stale).toBeUndefined();
  });

  it('does not call markStale with no current review', () => {
    const service = registerReviewService({ getIndex });
    const markStale = vi.spyOn(service.commands, 'markStale');
    const { channel } = createMockChannel();
    const { subscribeToModuleGraphChanges, fireChange } = createMockSubscribe();
    initializeReviewChannel(channel, { subscribeToModuleGraphChanges });

    fireChange();

    expect(markStale).not.toHaveBeenCalled();
  });

  it('does not call markStale when the current review is already stale', async () => {
    const service = registerReviewService({ getIndex });
    const { channel } = createMockChannel();
    const { subscribeToModuleGraphChanges, fireChange } = createMockSubscribe();
    initializeReviewChannel(channel, { subscribeToModuleGraphChanges });
    await channel.fire(REVIEW_EVENTS.PUSH_REVIEW, sampleReview);

    vi.spyOn(Date, 'now').mockReturnValue(NOW + 12_000);
    fireChange();
    await vi.waitFor(() => {
      expect(service.queries.current.get(undefined)?.stale).toBe(true);
    });

    const markStale = vi.spyOn(service.commands, 'markStale');
    fireChange();

    expect(markStale).not.toHaveBeenCalled();
  });

  it('tears down channel and module-graph listeners', () => {
    registerReviewService({ getIndex });
    const { channel } = createMockChannel();
    const unsubscribe = vi.fn();
    const subscribeToModuleGraphChanges = vi.fn(() => unsubscribe);

    const teardown = initializeReviewChannel(channel, { subscribeToModuleGraphChanges });
    teardown();
    teardowns.pop();

    expect(channel.off).toHaveBeenCalledWith(REVIEW_EVENTS.PUSH_REVIEW, expect.any(Function));
    expect(channel.off).toHaveBeenCalledWith(REVIEW_EVENTS.DISMISS_REVIEW, expect.any(Function));
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
