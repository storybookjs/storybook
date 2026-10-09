import { describe, expect, it, vi } from 'vitest';

import type { StoryIndex, StoryIndexEntry } from 'storybook/internal/types';

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

  const primaryStory = mockStoryIndex.entries['button--primary'] as StoryIndexEntry;

  const ordersIndex: StoryIndex = {
    v: 5,
    entries: Object.fromEntries(
      ['loaded', 'empty', 'error-state'].map((name) => [
        `orders--${name}`,
        {
          type: 'story',
          subtype: 'story',
          id: `orders--${name}`,
          name,
          title: 'Orders',
          importPath: './src/Orders.stories.tsx',
          tags: ['story'],
        },
      ])
    ),
  };

  it('finds a story by storyId', () => {
    const stories: StoryInput[] = [{ storyId: 'button--primary' }];

    const result = findStoryIds(mockStoryIndex, stories);

    expect(result).toEqual([
      { entry: mockStoryIndex.entries['button--primary'], input: stories[0] },
    ]);
  });

  it('returns not found for a missing storyId', () => {
    const stories: StoryInput[] = [{ storyId: 'button--does-not-exist' }];

    const result = findStoryIds(mockStoryIndex, stories);

    expect(result).toHaveLength(1);
    expect((result[0] as { errorMessage: string }).errorMessage).toContain(
      'button--does-not-exist'
    );
  });

  it('suggests the closest story IDs of the same component first', () => {
    const result = findStoryIds(mockStoryIndex, [{ storyId: 'button--primry' }]);

    expect((result[0] as { errorMessage: string }).errorMessage).toBe(
      'No story found for story ID "button--primry". Did you mean "button--primary", "button--secondary"?'
    );
  });

  it('ranks a story whose name extends the guess first', () => {
    const [result] = findStoryIds(ordersIndex, [{ storyId: 'orders--error' }]);

    expect((result as { errorMessage: string }).errorMessage).toBe(
      'No story found for story ID "orders--error". Did you mean "orders--error-state", "orders--empty", "orders--loaded"?'
    );
  });

  it('ranks a story whose name the guess contains first', () => {
    const [result] = findStoryIds(ordersIndex, [{ storyId: 'orders--empty-state' }]);

    expect((result as { errorMessage: string }).errorMessage).toMatch(
      /Did you mean "orders--empty", /
    );
  });

  it('suggests the same component when the guess lacks the title prefix', () => {
    const index: StoryIndex = {
      v: 5,
      entries: {
        'example-button--primary': {
          ...primaryStory,
          id: 'example-button--primary',
          title: 'Example/Button',
        },
      },
    };

    const [result] = findStoryIds(index, [{ storyId: 'button--primary' }]);

    expect((result as { errorMessage: string }).errorMessage).toBe(
      'No story found for story ID "button--primary". Did you mean "example-button--primary"?'
    );
  });

  it('suggests an ID of another component only when it is a few edits away', () => {
    const [nearMiss, farMiss] = findStoryIds(mockStoryIndex, [
      { storyId: 'inputs--default' },
      { storyId: 'checkbox--checked' },
    ]);

    expect((nearMiss as { errorMessage: string }).errorMessage).toBe(
      'No story found for story ID "inputs--default". Did you mean "input--default"?'
    );
    expect((farMiss as { errorMessage: string }).errorMessage).toBe(
      'No story found for story ID "checkbox--checked"'
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

    expect(result).toEqual([
      { entry: mockStoryIndex.entries['button--primary'], input: stories[0] },
    ]);
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

    expect(result).toEqual([
      { entry: mockStoryIndex.entries['button--primary'], input: stories[0] },
    ]);
  });

  it('finds a story by exportName when the story has a custom name', () => {
    const index: StoryIndex = {
      v: 5,
      entries: {
        'button--primary': {
          ...primaryStory,
          name: 'Main button',
          exportName: 'Primary',
        },
      },
    };
    const stories: StoryInput[] = [
      { exportName: 'Primary', absoluteStoryPath: `${process.cwd()}/src/Button.stories.tsx` },
    ];

    expect(findStoryIds(index, stories)).toEqual([
      { entry: index.entries['button--primary'], input: stories[0] },
    ]);
  });

  it('says when the index has no stories for the file', () => {
    const stories: StoryInput[] = [
      {
        exportName: 'NonExistent',
        absoluteStoryPath: `${process.cwd()}/src/NonExistent.stories.tsx`,
      },
    ];

    const result = findStoryIds(mockStoryIndex, stories);

    expect((result[0] as { errorMessage: string }).errorMessage).toBe(
      `No story found for export name "NonExistent" with absolute file path "${process.cwd()}/src/NonExistent.stories.tsx". Storybook has no stories indexed for that file; check the path, and that the file matches the \`stories\` globs in the Storybook config`
    );
  });

  it('lists the stories of a known file when the export name misses', () => {
    const [result] = findStoryIds(mockStoryIndex, [
      { exportName: 'ErrorState', absoluteStoryPath: `${process.cwd()}/src/Button.stories.tsx` },
    ]);

    expect((result as { errorMessage: string }).errorMessage).toBe(
      `No story found for export name "ErrorState" with absolute file path "${process.cwd()}/src/Button.stories.tsx". Closest stories in that file: "button--primary" (named "Primary"), "button--secondary" (named "Secondary"). Pass one of these IDs as { storyId } instead`
    );
  });

  it('lists only stories, the closest five, when the export name misses', () => {
    const story = primaryStory;
    const index: StoryIndex = {
      v: 5,
      entries: {
        'button--docs': {
          type: 'docs',
          id: 'button--docs',
          name: 'Docs',
          title: 'Button',
          importPath: story.importPath,
          storiesImports: [],
        },
        'button--small:renders': {
          ...story,
          subtype: 'test',
          id: 'button--small:renders',
          name: 'Small',
        },
        ...Object.fromEntries(
          ['Small', 'Medium', 'Large', 'Huge', 'Tiny', 'Disabled'].map((name) => [
            `button--${name.toLowerCase()}`,
            { ...story, id: `button--${name.toLowerCase()}`, name },
          ])
        ),
      },
    };

    const [result] = findStoryIds(index, [
      { exportName: 'Smal', absoluteStoryPath: `${process.cwd()}/src/Button.stories.tsx` },
    ]);

    const { errorMessage } = result as { errorMessage: string };
    expect(errorMessage).toContain(
      'Closest stories in that file: "button--small" (named "Small"), '
    );
    expect(errorMessage.match(/"button--[a-z]+" \(named/g)).toHaveLength(5);
    expect(errorMessage).toContain(' (+1 more). Pass one of these IDs');
    expect(errorMessage).not.toMatch(/button--docs|:renders/);
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
    expect((result[1] as { entry: { id: string } }).entry.id).toBe('button--primary');
    expect((result[2] as { entry: { id: string } }).entry.id).toBe('input--default');
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

    expect(result).toEqual([
      { entry: mockStoryIndex.entries['button--primary'], input: stories[0] },
    ]);

    cwdSpy.mockRestore();
  });
});
