import { describe, expect, it, vi } from 'vitest';
import type { Status, StatusStoreByTypeId } from 'storybook/internal/types';
import { REVIEW_STATUS_TYPE_ID } from 'storybook/internal/types';

import type { ReviewState } from './review-state.ts';
import {
  REVIEWING_STATUS_VALUE,
  clearReviewStatuses,
  collectReviewStoryIds,
  syncReviewStatuses,
} from './review-status.ts';

const sampleReview: ReviewState = {
  title: 'Button refresh',
  description: 'Updated primary button styling.',
  collections: [
    {
      title: 'Button',
      rationale: 'Directly changed component.',
      storyIds: ['button--primary', 'button--secondary'],
    },
    {
      title: 'Forms',
      rationale: 'Consumer stories.',
      storyIds: ['form--default', 'button--primary'],
    },
  ],
};

const createMockStatusStore = () => {
  const statuses = new Map<string, Status>();

  const store: StatusStoreByTypeId = {
    typeId: REVIEW_STATUS_TYPE_ID,
    getAll: vi.fn(() => ({})),
    set: vi.fn((nextStatuses: Status[]) => {
      for (const status of nextStatuses) {
        statuses.set(status.storyId, status);
      }
    }),
    unset: vi.fn((storyIds?: string[]) => {
      if (!storyIds) {
        statuses.clear();
        return;
      }
      for (const storyId of storyIds) {
        statuses.delete(storyId);
      }
    }),
    onAllStatusChange: vi.fn(() => () => {}),
    onSelect: vi.fn(() => () => {}),
  };

  return { store, statuses };
};

describe('collectReviewStoryIds', () => {
  it('returns the unique story ids across all collections', () => {
    expect([...collectReviewStoryIds(sampleReview)].sort()).toEqual([
      'button--primary',
      'button--secondary',
      'form--default',
    ]);
  });
});

describe('syncReviewStatuses', () => {
  it('sets reviewing statuses for every story in the review', () => {
    const { store, statuses } = createMockStatusStore();
    const storyIds = collectReviewStoryIds(sampleReview);

    syncReviewStatuses(store, storyIds, new Set());

    expect(store.set).toHaveBeenCalledOnce();
    expect([...statuses.keys()].sort()).toEqual([
      'button--primary',
      'button--secondary',
      'form--default',
    ]);
    expect(statuses.get('button--primary')).toMatchObject({
      typeId: REVIEW_STATUS_TYPE_ID,
      value: REVIEWING_STATUS_VALUE,
    });
  });

  it('removes reviewing statuses for stories no longer in the review', () => {
    const { store, statuses } = createMockStatusStore();
    const initial = syncReviewStatuses(store, collectReviewStoryIds(sampleReview), new Set());
    const nextReviewIds = new Set(['button--primary']);

    syncReviewStatuses(store, nextReviewIds, initial);

    expect(store.unset).toHaveBeenCalledWith(['button--secondary', 'form--default']);
    expect([...statuses.keys()]).toEqual(['button--primary']);
  });
});

describe('clearReviewStatuses', () => {
  it('clears all review statuses from the typed store', () => {
    const { store, statuses } = createMockStatusStore();
    syncReviewStatuses(store, collectReviewStoryIds(sampleReview), new Set());

    clearReviewStatuses(store);

    expect(store.unset).toHaveBeenCalledWith();
    expect(statuses.size).toBe(0);
  });
});
