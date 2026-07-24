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
  tags: ['story'],
} as const;

const index = {
  v: 5,
  entries: { 'button--primary': storyEntry },
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
  beforeEach(() => {
    clearRegistry();
    getIndex.mockResolvedValue(index);
  });

  afterEach(() => {
    clearRegistry();
    vi.restoreAllMocks();
  });

  it('leaves state command handlers to server registration', () => {
    expect(reviewServiceDef.commands.setReview.handler).toBeUndefined();
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

  it('sets, marks stale, and dismisses the current review', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const service = registerReviewService({ getIndex });

    expect(service.queries.current.get(undefined)).toBeNull();

    await service.commands.setReview({ ...review, stale: true, createdAt: 100 });

    expect(service.queries.current.get(undefined)).toEqual({ ...review, createdAt: 1_000 });
    expect(getIndex).toHaveBeenCalledOnce();

    vi.spyOn(Date, 'now').mockReturnValue(12_000);
    await service.commands.markStale(undefined);
    expect(service.queries.current.get(undefined)).toEqual({
      ...review,
      createdAt: 1_000,
      stale: true,
    });

    await service.commands.dismissReview(undefined);
    expect(service.queries.current.get(undefined)).toBeNull();
  });
});
