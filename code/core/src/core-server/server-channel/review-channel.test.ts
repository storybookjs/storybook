import type { Channel } from 'storybook/internal/channels';

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

describe('initReviewChannel', () => {
  const NOW = new Date().getTime();

  beforeEach(() => {
    clearRegistry();
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adapts legacy PUSH_REVIEW into authoritative OSA state', async () => {
    const service = registerReviewService();
    const { channel, emitted } = createMockChannel();

    initReviewChannel(channel);
    await channel.fire(REVIEW_EVENTS.PUSH_REVIEW, { ...sampleReview, stale: true });

    expect(service.queries.current.get(undefined)).toEqual({
      ...sampleReview,
      createdAt: NOW,
    });
    expect(emitted).toEqual([]);
  });

  it('dismisses OSA state and preserves return navigation broadcast', async () => {
    const service = registerReviewService();
    const { channel, emitted } = createMockChannel();

    initReviewChannel(channel);
    await channel.fire(REVIEW_EVENTS.PUSH_REVIEW, sampleReview);
    await channel.fire(REVIEW_EVENTS.DISMISS_REVIEW, '?path=/story/foo');

    expect(service.queries.current.get(undefined)).toBeNull();
    expect(emitted).toEqual([
      { event: REVIEW_EVENTS.REVIEW_DISMISSED, payload: '?path=/story/foo' },
    ]);
  });

  it('keeps only the legacy push and dismissal listeners', () => {
    registerReviewService();
    const { channel } = createMockChannel();

    initReviewChannel(channel, {
      subscribeToModuleGraphChanges: vi.fn(() => () => {}),
    });

    expect(channel.on).toHaveBeenCalledWith(REVIEW_EVENTS.PUSH_REVIEW, expect.any(Function));
    expect(channel.on).toHaveBeenCalledWith(REVIEW_EVENTS.DISMISS_REVIEW, expect.any(Function));
    expect(channel.on).toHaveBeenCalledTimes(2);
  });

  it('marks OSA state stale after the grace window', async () => {
    const service = registerReviewService();
    const { channel } = createMockChannel();
    const { subscribeToModuleGraphChanges, fireChange } = createMockSubscribe();
    initReviewChannel(channel, { subscribeToModuleGraphChanges });
    await channel.fire(REVIEW_EVENTS.PUSH_REVIEW, sampleReview);

    vi.spyOn(Date, 'now').mockReturnValue(NOW + 12_000);
    fireChange();

    await vi.waitFor(() => {
      expect(service.queries.current.get(undefined)?.stale).toBe(true);
    });
  });

  it('does not mark OSA state stale inside the grace window', async () => {
    const service = registerReviewService();
    const { channel } = createMockChannel();
    const { subscribeToModuleGraphChanges, fireChange } = createMockSubscribe();
    initReviewChannel(channel, { subscribeToModuleGraphChanges });
    await channel.fire(REVIEW_EVENTS.PUSH_REVIEW, sampleReview);

    fireChange();

    await vi.waitFor(() => {
      expect(service.queries.current.get(undefined)?.stale).toBeUndefined();
    });
  });
});
