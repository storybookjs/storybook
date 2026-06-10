import { describe, expect, it } from 'vitest';

import type { ReviewState } from './review-state.ts';
import {
  REVIEW_COLLECTION_QUERY_PARAM,
  buildFlattenedNavEntries,
  buildReviewChangesSummaryHref,
  buildReviewStoryHref,
  buildReviewStoryNavigationTarget,
  isReviewSummaryPath,
  parseCollectionIndex,
  parseReviewStoryHref,
  parseStoryIdFromPath,
  resolveActiveNavEntry,
  resolveNavIndex,
} from './review-navigation.ts';

const reviewState: ReviewState = {
  title: 'Test review',
  description: 'Test',
  collections: [
    {
      title: 'First',
      rationale: '',
      storyIds: ['story-a', 'story-b'],
    },
    {
      title: 'Second',
      rationale: '',
      storyIds: ['story-a', 'story-c'],
    },
  ],
};

describe('buildReviewStoryHref', () => {
  it('builds a story URL with collection query param', () => {
    expect(buildReviewStoryHref({ storyId: 'story-a', collectionIndex: 1 })).toBe(
      `?path=/story/story-a&${REVIEW_COLLECTION_QUERY_PARAM}=1`
    );
  });
});

describe('buildReviewStoryNavigationTarget', () => {
  it('builds a manager navigate target without the query wrapper', () => {
    expect(buildReviewStoryNavigationTarget({ storyId: 'story-a', collectionIndex: 1 })).toBe(
      `/story/story-a&${REVIEW_COLLECTION_QUERY_PARAM}=1`
    );
  });
});

describe('parseReviewStoryHref', () => {
  it('parses story hrefs built by buildReviewStoryHref', () => {
    const entry = { storyId: 'button-component--sizes', collectionIndex: 0 };
    expect(parseReviewStoryHref(buildReviewStoryHref(entry))).toEqual(entry);
  });

  it('returns null for malformed hrefs', () => {
    expect(parseReviewStoryHref('?path=/review/')).toBeNull();
    expect(parseReviewStoryHref('?path=/story/foo')).toBeNull();
  });
});

describe('buildFlattenedNavEntries', () => {
  it('includes every story occurrence across collections', () => {
    expect(buildFlattenedNavEntries(reviewState)).toEqual([
      { storyId: 'story-a', collectionIndex: 0 },
      { storyId: 'story-b', collectionIndex: 0 },
      { storyId: 'story-a', collectionIndex: 1 },
      { storyId: 'story-c', collectionIndex: 1 },
    ]);
  });
});

describe('resolveActiveNavEntry', () => {
  const entries = buildFlattenedNavEntries(reviewState);

  it('matches collection index when provided', () => {
    expect(resolveActiveNavEntry(entries, 'story-a', 1)).toEqual({
      storyId: 'story-a',
      collectionIndex: 1,
    });
  });

  it('falls back to the first matching story when collection is absent', () => {
    expect(resolveActiveNavEntry(entries, 'story-a')).toEqual({
      storyId: 'story-a',
      collectionIndex: 0,
    });
  });

  it('returns null when the story is not in the review', () => {
    expect(resolveActiveNavEntry(entries, 'missing')).toBeNull();
  });
});

describe('resolveNavIndex', () => {
  it('returns the index in the flattened list', () => {
    const entries = buildFlattenedNavEntries(reviewState);
    expect(resolveNavIndex(entries, { storyId: 'story-a', collectionIndex: 1 })).toBe(2);
  });
});

describe('path helpers', () => {
  it('detects the review summary path', () => {
    expect(isReviewSummaryPath('/review/')).toBe(true);
    expect(isReviewSummaryPath('/review/0/story-a')).toBe(false);
  });

  it('parses story ids from story paths', () => {
    expect(parseStoryIdFromPath('/story/foo--bar')).toBe('foo--bar');
    expect(parseStoryIdFromPath('/review/')).toBeNull();
  });

  it('parses collection index from query params', () => {
    expect(parseCollectionIndex('1')).toBe(1);
    expect(parseCollectionIndex('nope')).toBeUndefined();
  });

  it('builds the summary href', () => {
    expect(buildReviewChangesSummaryHref()).toBe('?path=/review/');
  });
});
