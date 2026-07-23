import type { StoryIndex } from 'storybook/internal/types';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { invokeApi } from '../../../public-api/index.ts';
import { createStoriesApi } from './definition.ts';

const index = {
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
} as StoryIndex;

const findStoriesByComponent = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  findStoriesByComponent.mockResolvedValue({
    results: [
      {
        componentPath: '/repo/src/Button.tsx',
        matches: [
          {
            storyId: 'button--primary',
            title: 'Button',
            name: 'Primary',
            importPath: './src/Button.stories.tsx',
            distance: 1,
          },
        ],
      },
    ],
  });
});

describe('stories API', () => {
  it('returns compact Markdown preview URLs by default', async () => {
    const storiesApi = createStoriesApi({
      getIndex: async () => index,
      getOrigin: () => 'http://localhost:6006',
      getChangeStatuses: async () => ({}),
      detectUnreachableFiles: async () => [],
      findStoriesByComponent,
    });

    await expect(
      invokeApi(storiesApi, 'preview', { stories: [{ storyId: 'button--primary' }] })
    ).resolves.toBe(
      [
        '# Story previews',
        '- Button - Primary',
        '  http://localhost:6006/?path=/story/button--primary',
      ].join('\n')
    );
  });

  it('returns the structured preview result with json true', async () => {
    const storiesApi = createStoriesApi({
      getIndex: async () => index,
      getOrigin: () => 'http://localhost:6006',
      getChangeStatuses: async () => ({}),
      detectUnreachableFiles: async () => [],
      findStoriesByComponent,
    });

    await expect(
      invokeApi(storiesApi, 'preview', { stories: [{ storyId: 'button--primary' }], json: true })
    ).resolves.toEqual({
      stories: [
        {
          title: 'Button',
          name: 'Primary',
          previewUrl: 'http://localhost:6006/?path=/story/button--primary',
        },
      ],
    });
  });

  it('formats component matches using the injected dependency', async () => {
    const storiesApi = createStoriesApi({
      getIndex: async () => index,
      getOrigin: () => 'http://localhost:6006',
      getChangeStatuses: async () => ({}),
      detectUnreachableFiles: async () => [],
      findStoriesByComponent,
    });

    await expect(
      invokeApi(storiesApi, 'findByComponent', { componentPaths: ['/repo/src/Button.tsx'] })
    ).resolves.toBe(
      [
        '# Stories by component',
        '## /repo/src/Button.tsx',
        '- Button - Primary (button--primary, distance 1)',
        '  ./src/Button.stories.tsx',
      ].join('\n')
    );
    expect(findStoriesByComponent).toHaveBeenCalledWith(['/repo/src/Button.tsx'], undefined);
  });

  it('creates a definition containing only public API fields', () => {
    const storiesApi = createStoriesApi({
      getIndex: async () => index,
      getOrigin: () => 'http://localhost:6006',
      getChangeStatuses: async () => ({}),
      detectUnreachableFiles: async () => [],
      findStoriesByComponent,
    });

    expect(Object.keys(storiesApi)).toEqual(['id', 'description', 'methods']);
    for (const method of Object.values(storiesApi.methods)) {
      expect(Object.keys(method).sort()).toEqual(['description', 'handler', 'schema']);
    }
  });
});
