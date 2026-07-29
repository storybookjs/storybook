// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReviewState } from './review-state.ts';
import { reviewStore, type ReviewDerivedState } from './review-store.ts';

const REVIEW_MODE_SESSION_KEY = 'storybook/review/review-mode';

const review: ReviewState = {
  title: 'Example review',
  description: '',
  createdAt: 1_700_000_000_000,
  collections: [{ title: 'A', rationale: '', storyIds: ['story--default'] }],
};

const emptyDerived: ReviewDerivedState = {
  review: null,
  pendingReview: null,
  storyInfo: {},
  flattenedEntries: [],
  newlyAddedStoryIds: new Set(),
  activeEntry: null,
  activeIndex: -1,
  isSummaryVisible: false,
  banner: null,
};

beforeEach(() => {
  sessionStorage.clear();
  reviewStore.reset();
});

describe('setDerived', () => {
  it('projects the pushed review payloads into the snapshot', () => {
    reviewStore.setDerived({ ...emptyDerived, review, pendingReview: null });
    expect(reviewStore.getState().review).toBe(review);
    expect(reviewStore.getState().pendingReview).toBeNull();

    reviewStore.setDerived(emptyDerived);
    expect(reviewStore.getState().review).toBeNull();
  });
});

describe('setReviewMode', () => {
  it('persists the flag so review mode survives reloads', () => {
    reviewStore.setReviewMode(true);
    expect(reviewStore.getState().isInReviewMode).toBe(true);
    expect(sessionStorage.getItem(REVIEW_MODE_SESSION_KEY)).toBe('1');

    reviewStore.setReviewMode(false);
    expect(reviewStore.getState().isInReviewMode).toBe(false);
    expect(sessionStorage.getItem(REVIEW_MODE_SESSION_KEY)).toBeNull();
  });
});

describe('subscribe', () => {
  it('notifies on writes and returns a fresh snapshot', () => {
    const listener = vi.fn();
    const unsubscribe = reviewStore.subscribe(listener);

    const before = reviewStore.getState();
    reviewStore.setReviewMode(true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(reviewStore.getState()).not.toBe(before);

    unsubscribe();
    reviewStore.setDerived(emptyDerived);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
