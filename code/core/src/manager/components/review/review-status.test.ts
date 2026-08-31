import type { Status, StatusStoreByTypeId } from 'storybook/internal/types';
import { REVIEW_STATUS_TYPE_ID } from 'storybook/internal/types';
import { describe, expect, it, vi } from 'vitest';

import type { ReviewState } from './review-state.ts';
import {
  REVIEWING_STATUS_VALUE,
  applyReviewStatuses,
  clearReviewStatuses,
  collectReviewStoryIds,
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

describe('applyReviewStatuses', () => {
  it('sets reviewing statuses for every story in the review', () => {
    const { store, statuses } = createMockStatusStore();
    const storyIds = collectReviewStoryIds(sampleReview);

    applyReviewStatuses(store, storyIds);

    expect(store.unset).toHaveBeenCalledOnce();
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

  it('clears orphaned reviewing statuses when a new review replaces the old one', () => {
    const { store, statuses } = createMockStatusStore();
    applyReviewStatuses(store, collectReviewStoryIds(sampleReview));

    applyReviewStatuses(store, new Set(['button--primary']));

    expect([...statuses.keys()]).toEqual(['button--primary']);
  });

  it('clears all reviewing statuses when the review has no stories', () => {
    const { store, statuses } = createMockStatusStore();
    applyReviewStatuses(store, collectReviewStoryIds(sampleReview));

    applyReviewStatuses(store, new Set());

    expect(statuses.size).toBe(0);
  });
});

describe('clearReviewStatuses', () => {
  it('clears all review statuses from the typed store', () => {
    const { store, statuses } = createMockStatusStore();
    applyReviewStatuses(store, collectReviewStoryIds(sampleReview));

    clearReviewStatuses(store);

    expect(store.unset).toHaveBeenCalledWith();
    expect(statuses.size).toBe(0);
  });
});
