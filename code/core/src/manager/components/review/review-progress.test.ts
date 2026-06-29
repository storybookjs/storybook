// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';

import type { ReviewNavEntry } from './review-navigation.ts';
import {
  clearReviewProgress,
  countReviewed,
  findFirstUnreviewedEntry,
  readReviewProgress,
  reviewEntryKey,
  writeReviewProgress,
} from './review-progress.ts';

beforeEach(() => {
  sessionStorage.clear();
});

describe('persistence', () => {
  it('round-trips reviewed ids keyed by createdAt', () => {
    writeReviewProgress(123, new Set(['a', 'b']));
    expect(readReviewProgress(123)).toEqual(new Set(['a', 'b']));
    // A different review (createdAt) starts empty.
    expect(readReviewProgress(456)).toEqual(new Set());
  });

  it('clears only the targeted review', () => {
    writeReviewProgress(123, new Set(['a']));
    writeReviewProgress(456, new Set(['b']));
    clearReviewProgress(123);
    expect(readReviewProgress(123)).toEqual(new Set());
    expect(readReviewProgress(456)).toEqual(new Set(['b']));
  });

  it('does not persist reviews without a createdAt', () => {
    writeReviewProgress(undefined, new Set(['a']));
    expect(readReviewProgress(undefined)).toEqual(new Set());
  });

  it('returns an empty set for corrupt values', () => {
    sessionStorage.setItem('storybook/review/progress/123', '{not json');
    expect(readReviewProgress(123)).toEqual(new Set());
  });
});

describe('helpers', () => {
  const entries: ReviewNavEntry[] = [
    { storyId: 'a', collectionIndex: 0 },
    { storyId: 'b', collectionIndex: 0 },
    { storyId: 'a', collectionIndex: 1 },
  ];

  it('counts only reviewed stories in the review set', () => {
    expect(countReviewed(new Set(['a', 'x']), new Set(['a', 'b']))).toBe(1);
  });

  it('finds the first unreviewed entry in collection order', () => {
    expect(findFirstUnreviewedEntry(entries, new Set(['a']))).toEqual({
      storyId: 'b',
      collectionIndex: 0,
    });
    expect(findFirstUnreviewedEntry(entries, new Set(['a', 'b']))).toBeNull();
  });

  it('keys entries by occurrence, not just story id', () => {
    expect(reviewEntryKey(entries[0])).toBe('0:a');
    expect(reviewEntryKey(entries[2])).toBe('1:a');
  });
});
