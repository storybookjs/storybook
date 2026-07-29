import { describe, expect, it, vi } from 'vitest';

import type { StoryIndex } from 'storybook/internal/types';

import { findStoryIds } from './find-story-ids.ts';
import type { StoryInput } from './story-input.ts';

describe('findStoryIds', () => {
  const mockStoryIndex: StoryIndex = {
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
    },
  };

  it('finds a story by storyId', () => {
    const stories: StoryInput[] = [{ storyId: 'button--primary' }];

    const result = findStoryIds(mockStoryIndex, stories);

    expect(result).toEqual([{ id: 'button--primary', input: stories[0] }]);
  });

  it('returns not found for a missing storyId', () => {
    const stories: StoryInput[] = [{ storyId: 'button--does-not-exist' }];

    const result = findStoryIds(mockStoryIndex, stories);

    expect(result).toHaveLength(1);
    expect((result[0] as { errorMessage: string }).errorMessage).toContain(
      'button--does-not-exist'
    );
  });

  it('finds a story by path and exportName', () => {
    const stories: StoryInput[] = [
      {
        exportName: 'Primary',
        absoluteStoryPath: `${process.cwd()}/src/Button.stories.tsx`,
      },
    ];

    const result = findStoryIds(mockStoryIndex, stories);

    expect(result).toEqual([{ id: 'button--primary', input: stories[0] }]);
  });

  it('finds a story by explicitStoryName when it differs from exportName', () => {
    const stories: StoryInput[] = [
      {
        exportName: 'SomeExport',
        explicitStoryName: 'Primary',
        absoluteStoryPath: `${process.cwd()}/src/Button.stories.tsx`,
      },
    ];

    const result = findStoryIds(mockStoryIndex, stories);

    expect(result).toEqual([{ id: 'button--primary', input: stories[0] }]);
  });

  it('hints about explicitStoryName when path+exportName miss', () => {
    const stories: StoryInput[] = [
      {
        exportName: 'NonExistent',
        absoluteStoryPath: `${process.cwd()}/src/NonExistent.stories.tsx`,
      },
    ];

    const result = findStoryIds(mockStoryIndex, stories);

    expect((result[0] as { errorMessage: string }).errorMessage).toContain(
      'did you forget to pass the explicit story name?'
    );
  });

  it('omits the hint when explicitStoryName was provided but not found', () => {
    const stories: StoryInput[] = [
      {
        exportName: 'NonExistent',
        explicitStoryName: 'NonExistent',
        absoluteStoryPath: `${process.cwd()}/src/NonExistent.stories.tsx`,
      },
    ];

    const result = findStoryIds(mockStoryIndex, stories);

    expect((result[0] as { errorMessage: string }).errorMessage).not.toContain(
      'did you forget to pass the explicit story name?'
    );
  });

  it('preserves input order for mixed found and not found results', () => {
    const stories: StoryInput[] = [
      { storyId: 'button--does-not-exist' },
      { exportName: 'Primary', absoluteStoryPath: `${process.cwd()}/src/Button.stories.tsx` },
      { storyId: 'input--default' },
      { exportName: 'Missing', absoluteStoryPath: `${process.cwd()}/src/Button.stories.tsx` },
    ];

    const result = findStoryIds(mockStoryIndex, stories);

    expect(result).toHaveLength(4);
    expect((result[0] as { errorMessage: string }).errorMessage).toContain(
      'button--does-not-exist'
    );
    expect((result[1] as { id: string }).id).toBe('button--primary');
    expect((result[2] as { id: string }).id).toBe('input--default');
    expect((result[3] as { errorMessage: string }).errorMessage).toContain('Missing');
  });

  it('matches when cwd and absolute path use Windows separators', () => {
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(String.raw`C:\repo`);

    const stories: StoryInput[] = [
      {
        exportName: 'Primary',
        absoluteStoryPath: String.raw`C:\repo\src\Button.stories.tsx`,
      },
    ];

    const result = findStoryIds(mockStoryIndex, stories);

    expect(result).toEqual([{ id: 'button--primary', input: stories[0] }]);

    cwdSpy.mockRestore();
  });
});
