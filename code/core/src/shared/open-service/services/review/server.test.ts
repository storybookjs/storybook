import type { StoryIndex } from 'storybook/internal/types';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OpenServiceUnknownStoryIdsError } from '../../../../server-errors.ts';
import { clearRegistry } from '../../server.ts';
import { reviewServiceDef } from './definition.ts';
import { registerReviewService } from './server.ts';

const storyEntry = {
  type: 'story',
  subtype: 'story',
  id: 'button--primary',
  name: 'Primary',
  title: 'Button',
  importPath: './src/Button.stories.tsx',
  tags: ['story'] as string[],
} as const;

const index = {
  v: 5,
  entries: {
    'button--primary': storyEntry,
    'card--basic': { ...storyEntry, id: 'card--basic', name: 'Basic', title: 'Card' },
    'button--docs': {
      type: 'docs',
      id: 'button--docs',
      name: 'Docs',
      title: 'Button',
      importPath: './src/Button.mdx',
      storiesImports: [],
      tags: ['docs'] as string[],
    },
  },
} as StoryIndex;

const review = {
  title: 'Button tweaks',
  description: 'Check primary',
  collections: [
    {
      title: 'Primary',
      rationale: 'edited',
      storyIds: ['button--primary'],
    },
  ],
  changedFiles: ['src/Button.tsx'],
};

const getIndex = vi.fn<() => Promise<StoryIndex>>();

describe('registerReviewService', () => {
  // Fixture-controlled clock: tests set `now` instead of re-spying Date.now.
  let now: number;

  beforeEach(() => {
    clearRegistry();
    getIndex.mockResolvedValue(index);
    now = 1_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    clearRegistry();
    vi.restoreAllMocks();
  });

  it('leaves state command handlers to server registration', () => {
    expect(reviewServiceDef.commands.setReview.handler).toBeUndefined();
    expect(reviewServiceDef.commands.acceptPending.handler).toBeUndefined();
    expect(reviewServiceDef.commands.markStale.handler).toBeUndefined();
    expect(reviewServiceDef.commands.dismissReview.handler).toBeUndefined();
  });

  it('rejects unknown story ids without updating state', async () => {
    const service = registerReviewService({ getIndex });

    const publish = service.commands.setReview({
      ...review,
      collections: [
        {
          ...review.collections[0],
          storyIds: ['missing--story', 'missing--story'],
        },
      ],
    });

    await expect(publish).rejects.toBeInstanceOf(OpenServiceUnknownStoryIdsError);
    await expect(publish).rejects.toMatchObject({
      data: { unknownIds: ['missing--story'] },
    });
    expect(service.queries.current.get(undefined)).toBeNull();
  });

  it('rejects docs entries, which cannot be navigated as review slots', async () => {
    const service = registerReviewService({ getIndex });

    const publish = service.commands.setReview({
      ...review,
      collections: [
        {
          ...review.collections[0],
          storyIds: ['button--primary', 'button--docs'],
        },
      ],
    });

    await expect(publish).rejects.toBeInstanceOf(OpenServiceUnknownStoryIdsError);
    await expect(publish).rejects.toMatchObject({ data: { unknownIds: ['button--docs'] } });
    expect(service.queries.current.get(undefined)).toBeNull();
  });

  it('preserves the current review when replacement story ids are unknown', async () => {
    const service = registerReviewService({ getIndex });
    await service.commands.setReview(review);
    const current = service.queries.current.get(undefined);

    await expect(
      service.commands.setReview({
        ...review,
        title: 'Invalid replacement',
        collections: [{ ...review.collections[0], storyIds: ['missing--story'] }],
      })
    ).rejects.toBeInstanceOf(OpenServiceUnknownStoryIdsError);

    expect(service.queries.current.get(undefined)).toEqual(current);
  });

  it('sets, marks stale, and dismisses the current review', async () => {
    const service = registerReviewService({ getIndex });

    expect(service.queries.current.get(undefined)).toBeNull();

    await service.commands.setReview({ ...review, stale: true, createdAt: 100 });

    expect(service.queries.current.get(undefined)).toEqual({ ...review, createdAt: 1_000 });
    expect(getIndex).toHaveBeenCalledOnce();

    now = 12_000;
    await service.commands.markStale(undefined);
    expect(service.queries.current.get(undefined)).toEqual({
      ...review,
      createdAt: 1_000,
      stale: true,
    });

    await service.commands.dismissReview(undefined);
    expect(service.queries.current.get(undefined)).toBeNull();
  });

  it('defers an incoming review to pending while a different one is current', async () => {
    const service = registerReviewService({ getIndex });
    await service.commands.setReview(review);

    now = 2_000;
    const updated = { ...review, title: 'Updated review' };
    await service.commands.setReview(updated);

    expect(service.queries.current.get(undefined)).toEqual({ ...review, createdAt: 1_000 });
    expect(service.queries.pending.get(undefined)).toEqual({ ...updated, createdAt: 2_000 });
  });

  it('replaces a held pending review with the latest incoming one', async () => {
    const service = registerReviewService({ getIndex });
    await service.commands.setReview(review);

    now = 2_000;
    await service.commands.setReview({ ...review, title: 'First update' });
    now = 3_000;
    await service.commands.setReview({ ...review, title: 'Second update' });

    expect(service.queries.pending.get(undefined)).toEqual({
      ...review,
      title: 'Second update',
      createdAt: 3_000,
    });
  });

  it('rejects unknown story ids in a deferred update without touching state', async () => {
    const service = registerReviewService({ getIndex });
    await service.commands.setReview(review);

    await expect(
      service.commands.setReview({
        ...review,
        collections: [{ ...review.collections[0], storyIds: ['missing--story'] }],
      })
    ).rejects.toBeInstanceOf(OpenServiceUnknownStoryIdsError);

    expect(service.queries.pending.get(undefined)).toBeNull();
  });

  it('promotes the pending review on acceptPending and clears it', async () => {
    const service = registerReviewService({ getIndex });
    await service.commands.setReview(review);
    now = 2_000;
    const updated = { ...review, title: 'Updated review' };
    await service.commands.setReview(updated);

    await service.commands.acceptPending(undefined);

    expect(service.queries.current.get(undefined)).toEqual({ ...updated, createdAt: 2_000 });
    expect(service.queries.pending.get(undefined)).toBeNull();
  });

  it('keeps the current review when acceptPending runs with nothing pending', async () => {
    const service = registerReviewService({ getIndex });
    await service.commands.setReview(review);

    await service.commands.acceptPending(undefined);

    expect(service.queries.current.get(undefined)).toEqual({ ...review, createdAt: 1_000 });
    expect(service.queries.pending.get(undefined)).toBeNull();
  });

  it('clears both current and pending on dismissal', async () => {
    const service = registerReviewService({ getIndex });
    await service.commands.setReview(review);
    now = 2_000;
    await service.commands.setReview({ ...review, title: 'Updated review' });

    await service.commands.dismissReview(undefined);

    expect(service.queries.current.get(undefined)).toBeNull();
    expect(service.queries.pending.get(undefined)).toBeNull();
  });

  it('does not mark the review stale inside the grace window', async () => {
    const service = registerReviewService({ getIndex });
    await service.commands.setReview(review);

    now = 5_000;
    await service.commands.markStale(undefined);

    expect(service.queries.current.get(undefined)).toEqual({ ...review, createdAt: 1_000 });
  });

  it('ignores markStale when no review is active', async () => {
    const service = registerReviewService({ getIndex });

    await service.commands.markStale(undefined);

    expect(service.queries.current.get(undefined)).toBeNull();
  });

  it('derives flattened navigation entries from the current review in display order', async () => {
    const service = registerReviewService({ getIndex });

    expect(service.queries.flattenedEntries.get(undefined)).toEqual([]);

    await service.commands.setReview({
      ...review,
      collections: [
        { title: 'Buttons', rationale: 'edited', storyIds: ['button--primary', 'card--basic'] },
        { title: 'Revisit', rationale: 'related', storyIds: ['button--primary'] },
      ],
    });

    expect(service.queries.flattenedEntries.get(undefined)).toEqual([
      { storyId: 'button--primary', collectionIndex: 0 },
      { storyId: 'card--basic', collectionIndex: 0 },
      { storyId: 'button--primary', collectionIndex: 1 },
    ]);

    await service.commands.dismissReview(undefined);

    expect(service.queries.flattenedEntries.get(undefined)).toEqual([]);
  });

  it('reports the banner kind with pending-update outranking stale', async () => {
    const service = registerReviewService({ getIndex });

    expect(service.queries.bannerKind.get(undefined)).toBeNull();

    await service.commands.setReview(review);
    expect(service.queries.bannerKind.get(undefined)).toBeNull();

    now = 12_000;
    await service.commands.markStale(undefined);
    expect(service.queries.bannerKind.get(undefined)).toBe('stale');

    now = 13_000;
    await service.commands.setReview({ ...review, title: 'Updated review' });
    expect(service.queries.bannerKind.get(undefined)).toBe('pending-update');

    // The promoted review is fresh, so accepting supersedes the stale warning.
    await service.commands.acceptPending(undefined);
    expect(service.queries.bannerKind.get(undefined)).toBeNull();
  });

  it('marks the current review stale on module-graph changes after the grace window', async () => {
    let onChange: (() => void) | undefined;
    const unsubscribe = vi.fn();
    const service = registerReviewService({
      getIndex,
      subscribeToModuleGraphChanges: (handler) => {
        onChange = handler;
        return unsubscribe;
      },
    });
    await service.commands.setReview(review);

    now = 5_000;
    onChange?.();
    await vi.waitFor(() => {
      expect(service.queries.current.get(undefined)).toEqual({ ...review, createdAt: 1_000 });
    });

    now = 12_000;
    onChange?.();
    await vi.waitFor(() => {
      expect(service.queries.current.get(undefined)).toEqual({
        ...review,
        createdAt: 1_000,
        stale: true,
      });
    });
  });
});
