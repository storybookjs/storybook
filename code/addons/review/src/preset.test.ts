import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Channel } from 'storybook/internal/channels';
import type { Options } from 'storybook/internal/types';

import { EVENTS } from './constants.ts';
import type { ReviewState } from './review-state.ts';
import { __resetCache, experimental_serverChannel } from './preset.ts';

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
  beforeEach(() => {
    __resetCache();
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
        payload: { ...sampleReview, branchName: 'feature/badge-pink' },
      },
    ]);
  });

  it('on PUSH_REVIEW with no resolvable branch (e.g. non-git target), broadcasts unchanged', async () => {
    const { channel, emitted } = createMockChannel();
    const resolveBranch = vi.fn().mockResolvedValue(undefined);

    await experimental_serverChannel(channel, {} as Options, { resolveBranch });
    await (channel as any).fire(EVENTS.PUSH_REVIEW, sampleReview);

    expect(emitted).toEqual([{ event: EVENTS.DISPLAY_REVIEW, payload: sampleReview }]);
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
        payload: { ...sampleReview, branchName: 'local/branch' },
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
        payload: { ...sampleReview, branchName: 'feature/badge-pink' },
      },
    ]);
  });

  it('registers exactly one listener per cross-repo event', async () => {
    const { channel } = createMockChannel();

    await experimental_serverChannel(channel, {} as Options, {
      resolveBranch: vi.fn().mockResolvedValue(undefined),
    });

    expect(channel.on).toHaveBeenCalledWith(EVENTS.PUSH_REVIEW, expect.any(Function));
    expect(channel.on).toHaveBeenCalledWith(EVENTS.REQUEST_REVIEW, expect.any(Function));
    expect(channel.on).toHaveBeenCalledTimes(2);
  });
});
