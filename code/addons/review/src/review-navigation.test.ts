import { describe, expect, it } from 'vitest';

import type { ReviewState } from './review-state.ts';
import {
  REVIEW_COLLECTION_QUERY_PARAM,
  buildFlattenedNavEntries,
  buildReviewChangesSummaryHref,
  buildReviewStoryHref,
  buildReviewStoryNavigationTarget,
  buildSummaryBackHref,
  getAdjacentCollectionFirstStory,
  getReviewDetailNeighbors,
  isReviewSessionPath,
  isReviewStoryRoute,
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
    expect(parseCollectionIndex('')).toBeUndefined();
    expect(parseCollectionIndex('   ')).toBeUndefined();
  });

  it('detects review session routes from path and collection', () => {
    expect(isReviewSessionPath('/review/', undefined)).toBe(true);
    expect(isReviewSessionPath('/review', undefined)).toBe(true);
    expect(isReviewStoryRoute('/story/foo--bar', 0)).toBe(true);
    expect(isReviewStoryRoute('/story/foo--bar', undefined)).toBe(false);
    expect(isReviewSessionPath('/story/foo--bar', 1)).toBe(true);
    expect(isReviewSessionPath('/story/foo--bar', undefined)).toBe(false);
  });

  it('builds the summary href', () => {
    expect(buildReviewChangesSummaryHref()).toBe('?path=/review/');
  });
});

describe('getReviewDetailNeighbors', () => {
  const sequence = buildFlattenedNavEntries(reviewState);

  it('crosses into the next collection at a collection boundary', () => {
    expect(getReviewDetailNeighbors(sequence, 1)?.next).toEqual({
      collectionIndex: 1,
      storyId: 'story-a',
    });
  });

  it('crosses into the previous collection at a collection boundary', () => {
    expect(getReviewDetailNeighbors(sequence, 2)?.previous).toEqual({
      collectionIndex: 0,
      storyId: 'story-b',
    });
  });

  it('wraps from the last story to the first and back', () => {
    expect(getReviewDetailNeighbors(sequence, sequence.length - 1)?.next).toEqual({
      collectionIndex: 0,
      storyId: 'story-a',
    });
    expect(getReviewDetailNeighbors(sequence, 0)?.previous).toEqual({
      collectionIndex: 1,
      storyId: 'story-c',
    });
  });

  it('returns null for an empty sequence or an out-of-range index', () => {
    expect(getReviewDetailNeighbors([], 0)).toBeNull();
    expect(getReviewDetailNeighbors(sequence, -1)).toBeNull();
    expect(getReviewDetailNeighbors(sequence, sequence.length)).toBeNull();
  });
});

describe('getAdjacentCollectionFirstStory', () => {
  const collections = reviewState.collections;

  it('jumps to the first story of the next collection', () => {
    expect(getAdjacentCollectionFirstStory(collections, 0, 1)).toEqual({
      collectionIndex: 1,
      storyId: 'story-a',
    });
  });

  it('jumps to the first story of the previous collection', () => {
    expect(getAdjacentCollectionFirstStory(collections, 1, -1)).toEqual({
      collectionIndex: 0,
      storyId: 'story-a',
    });
  });

  it('wraps from the last collection forward to the first', () => {
    expect(getAdjacentCollectionFirstStory(collections, 1, 1)).toEqual({
      collectionIndex: 0,
      storyId: 'story-a',
    });
  });

  it('wraps from the first collection backward to the last', () => {
    expect(getAdjacentCollectionFirstStory(collections, 0, -1)).toEqual({
      collectionIndex: 1,
      storyId: 'story-a',
    });
  });

  it('skips empty collections when stepping', () => {
    const withEmpty = [{ storyIds: ['a--1'] }, { storyIds: [] }, { storyIds: ['c--1'] }];
    expect(getAdjacentCollectionFirstStory(withEmpty, 0, 1)).toEqual({
      collectionIndex: 2,
      storyId: 'c--1',
    });
  });

  it('returns null when no collection has stories', () => {
    expect(getAdjacentCollectionFirstStory([{ storyIds: [] }], 0, 1)).toBeNull();
    expect(getAdjacentCollectionFirstStory([], 0, 1)).toBeNull();
  });
});

describe('buildSummaryBackHref', () => {
  it('returns the last viewed search when recorded', () => {
    expect(buildSummaryBackHref('?path=/story/foo')).toBe('?path=/story/foo');
  });

  it('falls back to the Storybook root when nothing is recorded', () => {
    expect(buildSummaryBackHref(null)).toBe('/');
    expect(buildSummaryBackHref(undefined)).toBe('/');
  });
});
