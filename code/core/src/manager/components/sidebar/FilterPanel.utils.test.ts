import { describe, expect, it } from 'vitest';

import type {
  StoryIndex,
  StoryIndexEntry,
  StatusesByStoryIdAndTypeId,
} from 'storybook/internal/types';

import { computeFilterPanelCounts } from './FilterPanel.utils.ts';

describe('FilterPanel.utils', () => {
  it('computes current counts and tag projections', () => {
    const indexJson = {
      v: 6,
      entries: {
        'foo-1': { tags: ['foo', 'ter'], type: 'story' } as StoryIndexEntry,
        'foo-2': { tags: ['foo', 'ter'], type: 'story' } as StoryIndexEntry,
        'foo-3': { tags: ['foo', 'ter'], type: 'story' } as StoryIndexEntry,
        'foo-4': { tags: ['foo', 'ter'], type: 'story' } as StoryIndexEntry,
        'foo-5': { tags: ['foo', 'ter'], type: 'story' } as StoryIndexEntry,
        'bar-1': { tags: ['bar'], type: 'story' } as StoryIndexEntry,
        'bar-2': { tags: ['bar'], type: 'story' } as StoryIndexEntry,
        'bar-3': { tags: ['bar'], type: 'story' } as StoryIndexEntry,
        'bar-4': { tags: ['bar'], type: 'story' } as StoryIndexEntry,
        'bar-5': { tags: ['bar'], type: 'story' } as StoryIndexEntry,
        'ter-1': { tags: ['ter'], type: 'story' } as StoryIndexEntry,
        'ter-2': { tags: ['ter'], type: 'story' } as StoryIndexEntry,
        'ter-3': { tags: ['ter'], type: 'story' } as StoryIndexEntry,
        'ter-4': { tags: ['ter'], type: 'story' } as StoryIndexEntry,
        'ter-5': { tags: ['ter'], type: 'story' } as StoryIndexEntry,
        'ter-6': { tags: ['ter'], type: 'story' } as StoryIndexEntry,
        'ter-7': { tags: ['ter'], type: 'story' } as StoryIndexEntry,
        'ter-8': { tags: ['ter'], type: 'story' } as StoryIndexEntry,
        'ter-9': { tags: ['ter'], type: 'story' } as StoryIndexEntry,
        'ter-10': { tags: ['ter'], type: 'story' } as StoryIndexEntry,
      },
    } as StoryIndex;

    const counts = computeFilterPanelCounts({
      allStatuses: {},
      excludedFilters: [],
      excludedStatusFilters: [],
      includedFilters: ['foo', 'bar'],
      includedStatusFilters: [],
      indexJson,
      statusValues: [],
      tagIds: ['foo', 'bar', 'ter'],
    });

    expect(counts.currentVisibleCount).toBe(10);
    expect(counts.totalCount).toBe(20);
    expect(counts.tags.foo.visibleCount).toBe(5);
    expect(counts.tags.bar.visibleCount).toBe(5);
    expect(counts.tags.ter.visibleCount).toBe(5);
    expect(counts.tags.ter.toggle).toEqual({ delta: 10, visibleCount: 20 });
    expect(counts.tags.ter.invert).toEqual({ delta: -5, visibleCount: 5 });
  });

  it('computes current counts and status projections', () => {
    const indexJson = {
      v: 6,
      entries: {
        'story-1': { tags: ['foo'], type: 'story' } as StoryIndexEntry,
        'story-2': { tags: ['bar'], type: 'story' } as StoryIndexEntry,
        'story-3': { tags: ['baz'], type: 'story' } as StoryIndexEntry,
      },
    } as StoryIndex;
    const allStatuses = {
      'story-1': {
        change: {
          description: '',
          storyId: 'story-1',
          title: 'New',
          typeId: 'change',
          value: 'status-value:new',
        },
      },
      'story-2': {
        change: {
          description: '',
          storyId: 'story-2',
          title: 'Modified',
          typeId: 'change',
          value: 'status-value:modified',
        },
      },
    } as StatusesByStoryIdAndTypeId;

    const counts = computeFilterPanelCounts({
      allStatuses,
      excludedFilters: [],
      excludedStatusFilters: [],
      includedFilters: [],
      includedStatusFilters: ['status-value:new'],
      indexJson,
      statusValues: ['status-value:new', 'status-value:modified'],
      tagIds: [],
    });

    expect(counts.currentVisibleCount).toBe(1);
    expect(counts.statuses['status-value:new']).toEqual({
      invert: { delta: 1, visibleCount: 2 },
      toggle: { delta: 2, visibleCount: 3 },
      visibleCount: 1,
    });
    expect(counts.statuses['status-value:modified']).toEqual({
      invert: { delta: 0, visibleCount: 1 },
      toggle: { delta: 1, visibleCount: 2 },
      visibleCount: 0,
    });
  });
});
