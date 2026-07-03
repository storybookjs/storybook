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

const updatedReview: ReviewState = {
  ...review,
  title: 'Updated review',
  createdAt: review.createdAt! + 60_000,
};

const derived: ReviewDerivedState = {
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

describe('displayReview', () => {
  it('shows the review and derives staleness from the payload', () => {
    reviewStore.displayReview({ ...review, stale: true });
    expect(reviewStore.getState().state?.title).toBe('Example review');
    expect(reviewStore.getState().isStale).toBe(true);

    reviewStore.displayReview(updatedReview);
    expect(reviewStore.getState().state).toBe(updatedReview);
    expect(reviewStore.getState().isStale).toBe(false);
  });

  it('clears any deferred payload', () => {
    reviewStore.displayReview(review);
    reviewStore.deferReview(updatedReview);
    reviewStore.displayReview(updatedReview);
    expect(reviewStore.getState().pendingReview).toBeNull();
  });
});

describe('deferReview', () => {
  it('holds the update without replacing the displayed review', () => {
    reviewStore.displayReview(review);
    reviewStore.deferReview(updatedReview);
    expect(reviewStore.getState().state).toBe(review);
    expect(reviewStore.getState().pendingReview).toBe(updatedReview);
  });
});

describe('clearReview', () => {
  it('drops displayed, deferred, stale, and review-mode state', () => {
    reviewStore.displayReview({ ...review, stale: true });
    reviewStore.deferReview(updatedReview);
    reviewStore.setReviewMode(true);

    reviewStore.clearReview();

    const state = reviewStore.getState();
    expect(state.state).toBeNull();
    expect(state.pendingReview).toBeNull();
    expect(state.isStale).toBe(false);
    expect(state.isInReviewMode).toBe(false);
    expect(sessionStorage.getItem(REVIEW_MODE_SESSION_KEY)).toBeNull();
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
    reviewStore.displayReview(review);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(reviewStore.getState()).not.toBe(before);

    unsubscribe();
    reviewStore.setStale(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
