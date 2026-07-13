import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Channel } from 'storybook/internal/channels';

import { REVIEW_EVENTS } from '../../shared/review/events.ts';
import type { ReviewState } from '../../shared/review/review-state.ts';
import { initReviewChannel } from './review-channel.ts';

function createMockSubscribe() {
  let captured: (() => void) | undefined;
  const subscribeToModuleGraphChanges = vi.fn((onChange: () => void) => {
    captured = onChange;
    return () => {
      captured = undefined;
    };
  });
  return {
    subscribeToModuleGraphChanges,
    fireChange: () => captured?.(),
  };
}

function createMockChannel() {
  const listeners = new Map<string, Array<(...args: any[]) => void>>();
  const emitted: Array<{ event: string; payload: unknown }> = [];

  const channel = {
    on: vi.fn((event: string, listener: (...args: any[]) => void) => {
      const arr = listeners.get(event) ?? [];
      arr.push(listener);
      listeners.set(event, arr);
    }),
    emit: vi.fn((event: string, payload?: unknown) => {
      emitted.push({ event, payload });
    }),
    fire: async (event: string, ...args: unknown[]) => {
      const arr = listeners.get(event) ?? [];
      for (const listener of arr) {
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
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('on PUSH_REVIEW, stamps createdAt, caches, and broadcasts DISPLAY_REVIEW', async () => {
    const { channel, emitted } = createMockChannel();

    initReviewChannel(channel);
    await (channel as any).fire(REVIEW_EVENTS.PUSH_REVIEW, sampleReview);

    expect(emitted).toEqual([
      {
        event: REVIEW_EVENTS.DISPLAY_REVIEW,
        payload: { ...sampleReview, createdAt: NOW },
      },
    ]);
  });

  it('drops an agent-supplied stale flag so a fresh push starts non-stale', async () => {
    const { channel, emitted } = createMockChannel();
    const payloadWithStale: ReviewState = { ...sampleReview, stale: true };

    initReviewChannel(channel);
    await (channel as any).fire(REVIEW_EVENTS.PUSH_REVIEW, payloadWithStale);

    expect(emitted).toEqual([
      {
        event: REVIEW_EVENTS.DISPLAY_REVIEW,
        payload: { ...sampleReview, createdAt: NOW },
      },
    ]);
    expect((emitted[0].payload as ReviewState).stale).toBeUndefined();
  });

  it('on REQUEST_REVIEW with no cached state, emits nothing', async () => {
    const { channel, emitted } = createMockChannel();

    initReviewChannel(channel);
    await (channel as any).fire(REVIEW_EVENTS.REQUEST_REVIEW);

    expect(emitted).toEqual([]);
  });

  it('on REQUEST_REVIEW after a PUSH_REVIEW, replays the cached payload', async () => {
    const { channel, emitted } = createMockChannel();

    initReviewChannel(channel);
    await (channel as any).fire(REVIEW_EVENTS.PUSH_REVIEW, sampleReview);
    emitted.length = 0;
    await (channel as any).fire(REVIEW_EVENTS.REQUEST_REVIEW);

    expect(emitted).toEqual([
      { event: REVIEW_EVENTS.DISPLAY_REVIEW, payload: { ...sampleReview, createdAt: NOW } },
    ]);
  });

  it('registers exactly one listener per cross-repo event', async () => {
    const { channel } = createMockChannel();

    initReviewChannel(channel, {
      subscribeToModuleGraphChanges: vi.fn(() => () => {}),
    });

    expect(channel.on).toHaveBeenCalledWith(REVIEW_EVENTS.PUSH_REVIEW, expect.any(Function));
    expect(channel.on).toHaveBeenCalledWith(REVIEW_EVENTS.REQUEST_REVIEW, expect.any(Function));
    expect(channel.on).toHaveBeenCalledWith(REVIEW_EVENTS.DISMISS_REVIEW, expect.any(Function));
    expect(channel.on).toHaveBeenCalledTimes(3);
  });

  it('on DISMISS_REVIEW, clears cache and emits REVIEW_DISMISSED with return search', async () => {
    const { channel, emitted } = createMockChannel();

    initReviewChannel(channel);
    await (channel as any).fire(REVIEW_EVENTS.PUSH_REVIEW, sampleReview);
    emitted.length = 0;
    await (channel as any).fire(REVIEW_EVENTS.DISMISS_REVIEW, '?path=/story/foo');

    expect(emitted).toEqual([
      { event: REVIEW_EVENTS.REVIEW_DISMISSED, payload: '?path=/story/foo' },
    ]);

    emitted.length = 0;
    await (channel as any).fire(REVIEW_EVENTS.REQUEST_REVIEW);
    expect(emitted).toEqual([]);
  });

  describe('staleness', () => {
    const setup = () => {
      const { channel, emitted } = createMockChannel();
      const { subscribeToModuleGraphChanges, fireChange } = createMockSubscribe();
      initReviewChannel(channel, { subscribeToModuleGraphChanges });
      return { channel, emitted, fireChange };
    };

    const staleOf = (emitted: Array<{ event: string; payload: unknown }>) =>
      emitted.filter((e) => e.event === REVIEW_EVENTS.REVIEW_STALE);

    it('marks the cached review stale and emits REVIEW_STALE after the grace window', async () => {
      const { channel, emitted, fireChange } = setup();
      await (channel as any).fire(REVIEW_EVENTS.PUSH_REVIEW, sampleReview);

      // Past the grace window relative to createdAt (NOW).
      vi.spyOn(Date, 'now').mockReturnValue(NOW + 12_000);
      fireChange();

      expect(staleOf(emitted)).toHaveLength(1);

      // Replay to a late tab carries the staleness on the cached state.
      emitted.length = 0;
      await (channel as any).fire(REVIEW_EVENTS.REQUEST_REVIEW);
      expect(emitted).toEqual([
        {
          event: REVIEW_EVENTS.DISPLAY_REVIEW,
          payload: {
            ...sampleReview,
            createdAt: NOW,
            stale: true,
          },
        },
      ]);
    });

    it('ignores source changes within the grace window', async () => {
      const { channel, emitted, fireChange } = setup();
      await (channel as any).fire(REVIEW_EVENTS.PUSH_REVIEW, sampleReview);

      // Date.now is still NOW (mocked in beforeEach) → within grace.
      fireChange();

      expect(staleOf(emitted)).toHaveLength(0);
      emitted.length = 0;
      await (channel as any).fire(REVIEW_EVENTS.REQUEST_REVIEW);
      expect((emitted[0].payload as ReviewState).stale).toBeUndefined();
    });

    it('ignores source changes when no review is cached', () => {
      const { emitted, fireChange } = setup();

      vi.spyOn(Date, 'now').mockReturnValue(NOW + 12_000);
      fireChange();

      expect(emitted).toEqual([]);
    });

    it('emits REVIEW_STALE only once across multiple changes', async () => {
      const { channel, emitted, fireChange } = setup();
      await (channel as any).fire(REVIEW_EVENTS.PUSH_REVIEW, sampleReview);

      vi.spyOn(Date, 'now').mockReturnValue(NOW + 12_000);
      fireChange();
      fireChange();
      fireChange();

      expect(staleOf(emitted)).toHaveLength(1);
    });

    it('resets staleness when a new review is pushed', async () => {
      const { channel, emitted, fireChange } = setup();
      await (channel as any).fire(REVIEW_EVENTS.PUSH_REVIEW, sampleReview);

      vi.spyOn(Date, 'now').mockReturnValue(NOW + 12_000);
      fireChange();
      expect(staleOf(emitted)).toHaveLength(1);

      // A fresh push re-anchors createdAt and clears stale.
      await (channel as any).fire(REVIEW_EVENTS.PUSH_REVIEW, sampleReview);
      emitted.length = 0;
      await (channel as any).fire(REVIEW_EVENTS.REQUEST_REVIEW);
      expect((emitted[0].payload as ReviewState).stale).toBeUndefined();
    });
  });
});
