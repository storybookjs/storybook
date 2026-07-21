import { describe, expect, it } from 'vitest';

import type { StoryIndex } from 'storybook/internal/types';

import { previewStories } from './preview.ts';
import type { StoryInput } from './story-input.ts';

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

describe('previewStories', () => {
  it('builds a preview URL for a storyId hit', () => {
    const result = previewStories({
      origin: 'http://localhost:6006',
      index,
      stories: [{ storyId: 'button--primary' }],
    });

    expect(result).toEqual({
      stories: [
        {
          title: 'Button',
          name: 'Primary',
          previewUrl: 'http://localhost:6006/?path=/story/button--primary',
        },
      ],
    });
  });

  it('appends args and globals query params', () => {
    const result = previewStories({
      origin: 'http://localhost:6006',
      index,
      stories: [
        {
          storyId: 'button--primary',
          props: { label: 'Hi', disabled: true },
          globals: { theme: 'dark' },
        },
      ],
    });

    const url = (result.stories[0] as { previewUrl: string }).previewUrl;
    expect(url).toContain('http://localhost:6006/?path=/story/button--primary');
    expect(url).toContain('&args=');
    expect(url).toContain('label:Hi');
    expect(url).toContain('disabled:!true');
    expect(url).toContain('&globals=');
    expect(url).toContain('theme:dark');
  });

  it('returns a per-input error for a missing storyId', () => {
    const input: StoryInput = { storyId: 'missing--story' };
    const result = previewStories({
      origin: 'http://localhost:6006',
      index,
      stories: [input],
    });

    expect(result).toEqual({
      stories: [
        {
          input,
          error: 'No story found for story ID "missing--story"',
        },
      ],
    });
  });

  it('resolves path+exportName and mixes success with failure', () => {
    const result = previewStories({
      origin: 'http://localhost:6006',
      index,
      stories: [
        {
          exportName: 'Primary',
          absoluteStoryPath: `${process.cwd()}/src/Button.stories.tsx`,
        },
        { storyId: 'does-not-exist' },
      ],
    });

    expect(result.stories).toHaveLength(2);
    expect(result.stories[0]).toMatchObject({
      title: 'Button',
      name: 'Primary',
      previewUrl: 'http://localhost:6006/?path=/story/button--primary',
    });
    expect(result.stories[1]).toMatchObject({
      error: expect.stringContaining('does-not-exist'),
    });
  });
});
