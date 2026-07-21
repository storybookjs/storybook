import { describe, expect, it } from 'vitest';

import type { StoryIndex } from 'storybook/internal/types';

import type { StatusesByStoryIdAndTypeId } from '../../../status-store/index.ts';
import { CHANGE_DETECTION_STATUS_TYPE_ID } from '../../../status-store/index.ts';
import { getChangedStories } from './changed.ts';

const index: StoryIndex = {
  v: 5,
  entries: {
    'button--primary': {
      type: 'story',
      subtype: 'story',
      id: 'button--primary',
      name: 'Primary',
      title: 'Button',
      importPath: './src/Button.stories.tsx',
      tags: ['story'],
    },
    'button--secondary': {
      type: 'story',
      subtype: 'story',
      id: 'button--secondary',
      name: 'Secondary',
      title: 'Button',
      importPath: './src/Button.stories.tsx',
      tags: ['story'],
    },
    'input--default': {
      type: 'story',
      subtype: 'story',
      id: 'input--default',
      name: 'Default',
      title: 'Input',
      importPath: './src/Input.stories.tsx',
      tags: ['story'],
    },
    'card--basic': {
      type: 'story',
      subtype: 'story',
      id: 'card--basic',
      name: 'Basic',
      title: 'Card',
      importPath: './src/Card.stories.tsx',
      tags: ['story'],
    },
  },
};

function status(
  storyId: string,
  value:
    | 'status-value:new'
    | 'status-value:modified'
    | 'status-value:affected'
    | 'status-value:success'
) {
  return {
    value,
    typeId: CHANGE_DETECTION_STATUS_TYPE_ID,
    storyId,
    title: 'Change detection',
    description: '',
  };
}

describe('getChangedStories', () => {
  it('filters to new/modified/affected and ignores other status values', () => {
    const statuses: StatusesByStoryIdAndTypeId = {
      'button--primary': {
        [CHANGE_DETECTION_STATUS_TYPE_ID]: status('button--primary', 'status-value:new'),
      },
      'input--default': {
        [CHANGE_DETECTION_STATUS_TYPE_ID]: status('input--default', 'status-value:success'),
      },
    };

    const result = getChangedStories({ statuses, index });

    expect(result.stories.map((s) => s.storyId)).toEqual(['button--primary']);
    expect(result.counts).toEqual({ new: 1, modified: 0, affected: 0 });
  });

  it('sorts by priority new → modified → affected, then storyId', () => {
    const statuses: StatusesByStoryIdAndTypeId = {
      'card--basic': {
        [CHANGE_DETECTION_STATUS_TYPE_ID]: status('card--basic', 'status-value:affected'),
      },
      'button--secondary': {
        [CHANGE_DETECTION_STATUS_TYPE_ID]: status('button--secondary', 'status-value:new'),
      },
      'input--default': {
        [CHANGE_DETECTION_STATUS_TYPE_ID]: status('input--default', 'status-value:modified'),
      },
      'button--primary': {
        [CHANGE_DETECTION_STATUS_TYPE_ID]: status('button--primary', 'status-value:new'),
      },
    };

    const result = getChangedStories({ statuses, index });

    expect(result.stories.map((s) => s.storyId)).toEqual([
      'button--primary',
      'button--secondary',
      'input--default',
      'card--basic',
    ]);
    expect(result.stories.map((s) => s.statusValue)).toEqual([
      'status-value:new',
      'status-value:new',
      'status-value:modified',
      'status-value:affected',
    ]);
  });

  it('computes counts and passes through unreachableFiles', () => {
    const statuses: StatusesByStoryIdAndTypeId = {
      'button--primary': {
        [CHANGE_DETECTION_STATUS_TYPE_ID]: status('button--primary', 'status-value:new'),
      },
      'button--secondary': {
        [CHANGE_DETECTION_STATUS_TYPE_ID]: status('button--secondary', 'status-value:modified'),
      },
      'input--default': {
        [CHANGE_DETECTION_STATUS_TYPE_ID]: status('input--default', 'status-value:affected'),
      },
      'card--basic': {
        [CHANGE_DETECTION_STATUS_TYPE_ID]: status('card--basic', 'status-value:affected'),
      },
    };

    const result = getChangedStories({
      statuses,
      index,
      unreachableFiles: ['/repo/src/theme.ts'],
    });

    expect(result.counts).toEqual({ new: 1, modified: 1, affected: 2 });
    expect(result.unreachableFiles).toEqual(['/repo/src/theme.ts']);
  });

  it('drops statuses whose storyId is missing from the index', () => {
    const statuses: StatusesByStoryIdAndTypeId = {
      'ghost--story': {
        [CHANGE_DETECTION_STATUS_TYPE_ID]: status('ghost--story', 'status-value:new'),
      },
    };

    const result = getChangedStories({ statuses, index });

    expect(result.stories).toEqual([]);
    expect(result.counts).toEqual({ new: 0, modified: 0, affected: 0 });
  });

  it('returns empty stories with unreachableFiles when nothing changed', () => {
    const result = getChangedStories({
      statuses: {},
      index,
      unreachableFiles: ['/repo/src/tokens.css'],
    });

    expect(result).toEqual({
      stories: [],
      counts: { new: 0, modified: 0, affected: 0 },
      unreachableFiles: ['/repo/src/tokens.css'],
    });
  });
});
