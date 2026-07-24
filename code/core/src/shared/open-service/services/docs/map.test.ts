import { describe, expect, it } from 'vitest';

import { Tag } from '../../../constants/tags.ts';
import { classifyIndex } from './classify-index.ts';
import { mapDocsList, mapDocsShow, mapDocsShowStory } from './map.ts';

describe('classifyIndex', () => {
  it('selects story-backed components and splits attached vs unattached docs', () => {
    const classification = classifyIndex({
      v: 5,
      entries: {
        'button--primary': {
          type: 'story',
          subtype: 'story',
          id: 'button--primary',
          name: 'Primary',
          title: 'Button',
          importPath: './Button.stories.tsx',
          tags: [Tag.MANIFEST],
        },
        'button--docs': {
          type: 'docs',
          id: 'button--docs',
          name: 'Docs',
          title: 'Button',
          importPath: './Button.mdx',
          storiesImports: ['./Button.stories.tsx'],
          tags: [Tag.MANIFEST, Tag.ATTACHED_MDX],
        },
        'guide--docs': {
          type: 'docs',
          id: 'guide--docs',
          name: 'Guide',
          title: 'Guide',
          importPath: './Guide.mdx',
          storiesImports: [],
          tags: [Tag.MANIFEST, Tag.UNATTACHED_MDX],
        },
      },
    });

    expect(classification.componentIds).toEqual(['button']);
    expect([...classification.storyBasedIds]).toEqual(['button']);
    expect(classification.attachedDocsByComponent.get('button')?.map((entry) => entry.id)).toEqual([
      'button--docs',
    ]);
    expect([...classification.unattachedDocs.keys()]).toEqual(['guide--docs']);
  });
});

describe('mapDocsList', () => {
  it('lists components and optional story ids', () => {
    const result = mapDocsList({
      classification: {
        componentIds: ['button'],
        storyBasedIds: new Set(['button']),
        attachedDocsByComponent: new Map(),
        unattachedDocs: new Map([
          [
            'guide--docs',
            {
              type: 'docs',
              id: 'guide--docs',
              name: 'Guide',
              title: 'Guide',
              importPath: './Guide.mdx',
              storiesImports: [],
              tags: [Tag.UNATTACHED_MDX],
            },
          ],
        ]),
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
