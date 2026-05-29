import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Channel } from 'storybook/internal/channels';
import type { FileChangeEvent } from 'storybook/internal/core-server';
import type { Options } from 'storybook/internal/types';

import { EVENTS } from './constants.ts';
import type { ReviewState } from './review-state.ts';
import { __resetCache, experimental_serverChannel } from './preset.ts';

function createMockSubscribe() {
  let captured: ((event: FileChangeEvent) => void) | undefined;
  const subscribeToSourceFileChanges = vi.fn((listener: (event: FileChangeEvent) => void) => {
    captured = listener;
    return () => {
      captured = undefined;
    };
  });
  return {
    subscribeToSourceFileChanges,
    fireChange: (
      event: FileChangeEvent = { kind: 'change', path: '/repo/src/Button.tsx' } as FileChangeEvent
    ) => captured?.(event),
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
      kind: 'atomic',
    },
  ],
};

describe('addon-review experimental_serverChannel', () => {
  const NOW = 1_700_000_000_000;

  beforeEach(() => {
    __resetCache();
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('on PUSH_REVIEW, enriches with git branch, caches, and broadcasts DISPLAY_REVIEW', async () => {
    const { channel, emitted } = createMockChannel();
    const resolveBranch = vi.fn().mockResolvedValue('feature/badge-pink');

    await experimental_serverChannel(channel, {} as Options, { resolveBranch });
    await (channel as any).fire(EVENTS.PUSH_REVIEW, sampleReview);

    expect(resolveBranch).toHaveBeenCalledTimes(1);
    expect(emitted).toEqual([
      {
        event: EVENTS.DISPLAY_REVIEW,
        payload: { ...sampleReview, branchName: 'feature/badge-pink', createdAt: NOW },
      },
    ]);
  });

  it('on PUSH_REVIEW with no resolvable branch (e.g. non-git target), broadcasts unchanged', async () => {
    const { channel, emitted } = createMockChannel();
    const resolveBranch = vi.fn().mockResolvedValue(undefined);

    await experimental_serverChannel(channel, {} as Options, { resolveBranch });
    await (channel as any).fire(EVENTS.PUSH_REVIEW, sampleReview);

    expect(emitted).toEqual([
      { event: EVENTS.DISPLAY_REVIEW, payload: { ...sampleReview, createdAt: NOW } },
    ]);
  });

  it('overwrites an agent-supplied branchName with the locally resolved one', async () => {
    const { channel, emitted } = createMockChannel();
    const resolveBranch = vi.fn().mockResolvedValue('local/branch');
    const payloadWithBranch: ReviewState = { ...sampleReview, branchName: 'agent/explicit' };

    await experimental_serverChannel(channel, {} as Options, { resolveBranch });
    await (channel as any).fire(EVENTS.PUSH_REVIEW, payloadWithBranch);

    expect(resolveBranch).toHaveBeenCalledTimes(1);
    expect(emitted).toEqual([
      {
        event: EVENTS.DISPLAY_REVIEW,
        payload: { ...sampleReview, branchName: 'local/branch', createdAt: NOW },
      },
    ]);
  });

  it('on REQUEST_REVIEW with no cached state, emits nothing', async () => {
    const { channel, emitted } = createMockChannel();

    await experimental_serverChannel(channel, {} as Options, {
      resolveBranch: vi.fn().mockResolvedValue(undefined),
    });
    await (channel as any).fire(EVENTS.REQUEST_REVIEW);

    expect(emitted).toEqual([]);
  });

  it('on REQUEST_REVIEW after a PUSH_REVIEW, replays the cached enriched payload', async () => {
    const { channel, emitted } = createMockChannel();
    const resolveBranch = vi.fn().mockResolvedValue('feature/badge-pink');

    await experimental_serverChannel(channel, {} as Options, { resolveBranch });
    await (channel as any).fire(EVENTS.PUSH_REVIEW, sampleReview);
    emitted.length = 0;
    await (channel as any).fire(EVENTS.REQUEST_REVIEW);

    expect(emitted).toEqual([
      {
        event: EVENTS.DISPLAY_REVIEW,
        payload: { ...sampleReview, branchName: 'feature/badge-pink', createdAt: NOW },
      },
    ]);
  });

  it('registers exactly one listener per cross-repo event', async () => {
    const { channel } = createMockChannel();

    await experimental_serverChannel(channel, {} as Options, {
      resolveBranch: vi.fn().mockResolvedValue(undefined),
      subscribeToSourceFileChanges: vi.fn(() => () => {}),
    });

    expect(channel.on).toHaveBeenCalledWith(EVENTS.PUSH_REVIEW, expect.any(Function));
    expect(channel.on).toHaveBeenCalledWith(EVENTS.REQUEST_REVIEW, expect.any(Function));
    expect(channel.on).toHaveBeenCalledTimes(2);
  });

  describe('staleness', () => {
    const setup = async () => {
      const { channel, emitted } = createMockChannel();
      const { subscribeToSourceFileChanges, fireChange } = createMockSubscribe();
      await experimental_serverChannel(channel, {} as Options, {
        resolveBranch: vi.fn().mockResolvedValue('feature/badge-pink'),
        subscribeToSourceFileChanges,
      });
      return { channel, emitted, fireChange };
    };

    const staleOf = (emitted: Array<{ event: string; payload: unknown }>) =>
      emitted.filter((e) => e.event === EVENTS.REVIEW_STALE);

    it('marks the cached review stale and emits REVIEW_STALE after the grace window', async () => {
      const { channel, emitted, fireChange } = await setup();
      await (channel as any).fire(EVENTS.PUSH_REVIEW, sampleReview);

      // Past the grace window relative to createdAt (NOW).
      vi.spyOn(Date, 'now').mockReturnValue(NOW + 2000);
      fireChange();

      expect(staleOf(emitted)).toHaveLength(1);

      // Replay to a late tab carries the staleness on the cached state.
      emitted.length = 0;
      await (channel as any).fire(EVENTS.REQUEST_REVIEW);
      expect(emitted).toEqual([
        {
          event: EVENTS.DISPLAY_REVIEW,
          payload: {
            ...sampleReview,
            branchName: 'feature/badge-pink',
            createdAt: NOW,
            stale: true,
          },
        },
      ]);
    });

    it('ignores source changes within the grace window', async () => {
      const { channel, emitted, fireChange } = await setup();
      await (channel as any).fire(EVENTS.PUSH_REVIEW, sampleReview);

      // Date.now is still NOW (mocked in beforeEach) → within grace.
      fireChange();

      expect(staleOf(emitted)).toHaveLength(0);
      emitted.length = 0;
      await (channel as any).fire(EVENTS.REQUEST_REVIEW);
      expect((emitted[0].payload as ReviewState).stale).toBeUndefined();
    });

    it('ignores source changes when no review is cached', async () => {
      const { emitted, fireChange } = await setup();

      vi.spyOn(Date, 'now').mockReturnValue(NOW + 2000);
      fireChange();

      expect(emitted).toEqual([]);
    });

    it('emits REVIEW_STALE only once across multiple changes', async () => {
      const { channel, emitted, fireChange } = await setup();
      await (channel as any).fire(EVENTS.PUSH_REVIEW, sampleReview);

      vi.spyOn(Date, 'now').mockReturnValue(NOW + 2000);
      fireChange();
      fireChange();
      fireChange();

      expect(staleOf(emitted)).toHaveLength(1);
    });

    it('resets staleness when a new review is pushed', async () => {
      const { channel, emitted, fireChange } = await setup();
      await (channel as any).fire(EVENTS.PUSH_REVIEW, sampleReview);

      vi.spyOn(Date, 'now').mockReturnValue(NOW + 2000);
      fireChange();
      expect(staleOf(emitted)).toHaveLength(1);

      // A fresh push re-anchors createdAt and clears stale.
      await (channel as any).fire(EVENTS.PUSH_REVIEW, sampleReview);
      emitted.length = 0;
      await (channel as any).fire(EVENTS.REQUEST_REVIEW);
      expect((emitted[0].payload as ReviewState).stale).toBeUndefined();
    });
  });
});
