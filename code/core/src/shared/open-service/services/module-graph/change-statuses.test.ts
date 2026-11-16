import { describe, expect, it } from 'vitest';

import { storyFileChangeStatuses } from './change-statuses.ts';

describe('storyFileChangeStatuses', () => {
  it('marks the closest story files modified and the ones further away affected', () => {
    const statuses = storyFileChangeStatuses([
      {
        isNew: false,
        stories: [
          { storyFile: './Button.stories.tsx', depth: 1 },
          { storyFile: './Form.stories.tsx', depth: 2 },
          { storyFile: './Icon.stories.tsx', depth: 1 },
        ],
      },
    ]);

    expect(Object.fromEntries(statuses)).toEqual({
      './Button.stories.tsx': 'status-value:modified',
      './Form.stories.tsx': 'status-value:affected',
      './Icon.stories.tsx': 'status-value:modified',
    });
  });

  it('marks a changed story file modified, and the stories of a new story file new', () => {
    const statuses = storyFileChangeStatuses([
      { isNew: false, stories: [{ storyFile: './Button.stories.tsx', depth: 0 }] },
      { isNew: true, stories: [{ storyFile: './Card.stories.tsx', depth: 0 }] },
    ]);

    expect(Object.fromEntries(statuses)).toEqual({
      './Button.stories.tsx': 'status-value:modified',
      './Card.stories.tsx': 'status-value:new',
    });
  });

  it('does not mark the stories that render a new component new', () => {
    const statuses = storyFileChangeStatuses([
      { isNew: true, stories: [{ storyFile: './Button.stories.tsx', depth: 1 }] },
    ]);

    expect(statuses.get('./Button.stories.tsx')).toBe('status-value:modified');
  });

  it('keeps the strongest status of a story file that several changed files reach', () => {
    const statuses = storyFileChangeStatuses([
      {
        isNew: false,
        stories: [
          { storyFile: './Button.stories.tsx', depth: 1 },
          { storyFile: './Form.stories.tsx', depth: 3 },
          { storyFile: './New.stories.tsx', depth: 2 },
        ],
      },
      { isNew: false, stories: [{ storyFile: './Form.stories.tsx', depth: 1 }] },
      { isNew: true, stories: [{ storyFile: './New.stories.tsx', depth: 0 }] },
      { isNew: false, stories: [{ storyFile: './Button.stories.tsx', depth: 4 }] },
    ]);

    expect(Object.fromEntries(statuses)).toEqual({
      './Button.stories.tsx': 'status-value:modified',
      './Form.stories.tsx': 'status-value:modified',
      './New.stories.tsx': 'status-value:new',
    });
  });

  it('ignores a changed file that no story renders', () => {
    expect(storyFileChangeStatuses([{ isNew: false, stories: [] }]).size).toBe(0);
  });
});
