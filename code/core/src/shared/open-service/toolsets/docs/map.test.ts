import { describe, expect, it } from 'vitest';

import { mapDocsList, mapDocsShow, mapDocsShowStory } from './map.ts';

describe('mapDocsList', () => {
  it('lists components and optional story ids', () => {
    const result = mapDocsList({
      classification: {
        componentIds: ['button'],
        storyBasedIds: new Set(['button']),
        attachedDocsByComponent: new Map(),
        unattachedDocs: new Map([['guide--docs', 'Guide']]),
      },
      allDocgen: {
        button: {
          id: 'button',
          name: 'Button',
          path: './Button.tsx',
          summary: 'A button',
          jsDocTags: {},
        },
      },
      allStoryDocs: {
        button: {
          id: 'button',
          name: 'Button',
          path: './Button.stories.tsx',
          stories: {
            'button--primary': { id: 'button--primary', name: 'Primary' },
          },
        },
      },
      allMdx: {
        'guide--docs': {
          id: 'guide--docs',
          name: 'Guide',
          docs: {
            'guide--docs': {
              id: 'guide--docs',
              name: 'Guide',
              title: 'Getting started',
              summary: 'Intro',
            },
          },
        },
      },
      withStoryIds: true,
    });

    expect(result).toEqual({
      components: [
        { id: 'button', name: 'Button', summary: 'A button', storyIds: ['button--primary'] },
      ],
      docs: [{ id: 'guide--docs', name: 'Guide', title: 'Getting started', summary: 'Intro' }],
    });
  });
});

describe('mapDocsShow / mapDocsShowStory', () => {
  it('maps component docs and story lookup outcomes', () => {
    const show = mapDocsShow({
      id: 'button',
      classification: {
        componentIds: ['button'],
        storyBasedIds: new Set(['button']),
        attachedDocsByComponent: new Map(),
        unattachedDocs: new Map(),
      },
      docgen: {
        id: 'button',
        name: 'Button',
        path: './Button.tsx',
        description: 'Click me',
        jsDocTags: {},
      },
      storyDocs: {
        id: 'button',
        name: 'Button',
        path: './Button.stories.tsx',
        import: "import { Button } from './Button'",
        stories: {
          'button--primary': {
            id: 'button--primary',
            name: 'Primary',
            snippet: '<Button />',
          },
        },
      },
    });

    expect(show).toMatchObject({
      kind: 'component',
      id: 'button',
      name: 'Button',
      import: "import { Button } from './Button'",
      stories: [{ id: 'button--primary', name: 'Primary', snippet: '<Button />' }],
    });

    expect(mapDocsShowStory({ componentId: 'button', storyName: 'Primary', show })).toMatchObject({
      kind: 'story',
      component: { id: 'button', name: 'Button' },
      story: { name: 'Primary' },
    });

    expect(mapDocsShowStory({ componentId: 'button', storyName: 'Missing', show })).toEqual({
      kind: 'story-not-found',
      componentId: 'button',
      storyName: 'Missing',
      availableStoryNames: ['Primary'],
    });
  });

  it('returns not-found for unknown ids', () => {
    expect(
      mapDocsShow({
        id: 'missing',
        classification: {
          componentIds: [],
          storyBasedIds: new Set(),
          attachedDocsByComponent: new Map(),
          unattachedDocs: new Map(),
        },
      })
    ).toEqual({ kind: 'not-found', id: 'missing' });
  });
});
