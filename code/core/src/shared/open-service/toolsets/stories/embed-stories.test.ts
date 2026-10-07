import { describe, expect, it } from 'vitest';

import type { StoryIndex } from 'storybook/internal/types';

import { embedStories } from './embed-stories.ts';

const embedOrigin = 'http://localhost:6006/embed/secret';

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
  },
};

describe('embedStories', () => {
  it('builds a standalone story URL under the embed origin', () => {
    expect(embedStories({ embedOrigin, index, stories: [{ storyId: 'button--primary' }] })).toEqual(
      {
        stories: [
          {
            title: 'Button',
            name: 'Primary',
            embedUrl: `${embedOrigin}/iframe.html?id=button--primary&viewMode=story`,
          },
        ],
      }
    );
  });

  it('appends args and globals query params', () => {
    const { stories } = embedStories({
      embedOrigin,
      index,
      stories: [
        {
          storyId: 'button--primary',
          props: { label: 'Hi', primary: true },
          globals: { theme: 'dark' },
        },
      ],
    });

    expect(stories).toEqual([
      {
        title: 'Button',
        name: 'Primary',
        embedUrl: `${embedOrigin}/iframe.html?id=button--primary&viewMode=story&args=label:Hi;primary:!true&globals=theme:dark`,
      },
    ]);
  });

  it('reports an error for a story that is not in the index', () => {
    const { stories } = embedStories({
      embedOrigin,
      index,
      stories: [{ storyId: 'missing--story' }],
    });

    expect(stories).toEqual([{ input: { storyId: 'missing--story' }, error: expect.any(String) }]);
  });
});
