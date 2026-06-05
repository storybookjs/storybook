import { describe, expect, it } from 'vitest';

import {
  flattenReviewStories,
  getAdjacentCollectionFirstStory,
  getReviewDetailNeighbors,
  storyPreviewUrl,
} from './review-navigation.ts';

describe('storyPreviewUrl', () => {
  it('stays interactive by default so the detail screen can be used', () => {
    const url = storyPreviewUrl('button--primary');
    expect(url).toBe('iframe.html?id=button--primary&viewMode=story');
    expect(url).not.toContain('freeze');
  });

  it('opts into the freeze contract for summary thumbnails', () => {
    const url = storyPreviewUrl('button--primary', { freeze: true });
    expect(url).toBe('iframe.html?id=button--primary&viewMode=story&freeze=finished');
  });
});

describe('flattenReviewStories', () => {
  it('concatenates every collection in order, tagging each story with its collection index', () => {
    const sequence = flattenReviewStories([{ storyIds: ['a--1', 'a--2'] }, { storyIds: ['b--1'] }]);
    expect(sequence).toEqual([
      { collectionIndex: 0, storyId: 'a--1' },
      { collectionIndex: 0, storyId: 'a--2' },
      { collectionIndex: 1, storyId: 'b--1' },
    ]);
  });

  it('skips empty collections without disturbing the collection indices', () => {
    const sequence = flattenReviewStories([
      { storyIds: ['a--1'] },
      { storyIds: [] },
      { storyIds: ['c--1'] },
    ]);
    expect(sequence).toEqual([
      { collectionIndex: 0, storyId: 'a--1' },
      { collectionIndex: 2, storyId: 'c--1' },
    ]);
  });
});

describe('getReviewDetailNeighbors', () => {
  const sequence = flattenReviewStories([
    { storyIds: ['a--1', 'a--2'] },
    { storyIds: ['b--1', 'b--2'] },
  ]);

  it('moves within a collection when the neighbors share it', () => {
    expect(getReviewDetailNeighbors(sequence, 0)).toEqual({
      previous: { collectionIndex: 1, storyId: 'b--2' },
      next: { collectionIndex: 0, storyId: 'a--2' },
    });
  });

  it('crosses into the next collection at a collection boundary', () => {
    expect(getReviewDetailNeighbors(sequence, 1)?.next).toEqual({
      collectionIndex: 1,
      storyId: 'b--1',
    });
  });

  it('crosses into the previous collection at a collection boundary', () => {
    expect(getReviewDetailNeighbors(sequence, 2)?.previous).toEqual({
      collectionIndex: 0,
      storyId: 'a--2',
    });
  });

  it('wraps from the last story to the first and back', () => {
    expect(getReviewDetailNeighbors(sequence, sequence.length - 1)?.next).toEqual({
      collectionIndex: 0,
      storyId: 'a--1',
    });
    expect(getReviewDetailNeighbors(sequence, 0)?.previous).toEqual({
      collectionIndex: 1,
      storyId: 'b--2',
    });
  });

  it('returns null for an empty sequence or an out-of-range index', () => {
    expect(getReviewDetailNeighbors([], 0)).toBeNull();
    expect(getReviewDetailNeighbors(sequence, -1)).toBeNull();
    expect(getReviewDetailNeighbors(sequence, sequence.length)).toBeNull();
  });
});

describe('getAdjacentCollectionFirstStory', () => {
  const collections = [
    { storyIds: ['a--1', 'a--2'] },
    { storyIds: ['b--1', 'b--2'] },
    { storyIds: ['c--1'] },
  ];

  it('jumps to the first story of the next collection', () => {
    expect(getAdjacentCollectionFirstStory(collections, 0, 1)).toEqual({
      collectionIndex: 1,
      storyId: 'b--1',
    });
  });

  it('jumps to the first story of the previous collection', () => {
    expect(getAdjacentCollectionFirstStory(collections, 1, -1)).toEqual({
      collectionIndex: 0,
      storyId: 'a--1',
    });
  });

  it('wraps from the last collection forward to the first', () => {
    expect(getAdjacentCollectionFirstStory(collections, 2, 1)).toEqual({
      collectionIndex: 0,
      storyId: 'a--1',
    });
  });

  it('wraps from the first collection backward to the last', () => {
    expect(getAdjacentCollectionFirstStory(collections, 0, -1)).toEqual({
      collectionIndex: 2,
      storyId: 'c--1',
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
