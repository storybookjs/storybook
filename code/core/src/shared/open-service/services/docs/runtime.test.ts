import { describe, expect, it } from 'vitest';

import { Tag } from '../../../constants/tags.ts';
import type { IndexClassification } from './classify-index.ts';
import { docsClassificationKey, restoreClassification, storeClassification } from './runtime.ts';

describe('docs classification storage', () => {
  const classification: IndexClassification = {
    componentIds: ['button', 'link'],
    storyBasedIds: new Set(['button']),
    attachedDocsByComponent: new Map([
      [
        'button',
        [
          {
            type: 'docs',
            id: 'button--docs',
            name: 'Docs',
            title: 'Button',
            importPath: './Button.mdx',
            storiesImports: ['./Button.stories.tsx'],
            tags: [Tag.ATTACHED_MDX],
          },
        ],
      ],
    ]),
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
  };

  it('round-trips Maps/Sets through the plain-object store form', () => {
    const restored = restoreClassification(storeClassification(classification));

    expect(restored.componentIds).toEqual(['button', 'link']);
    expect([...restored.storyBasedIds]).toEqual(['button']);
    expect(restored.attachedDocsByComponent.get('button')?.[0]?.id).toBe('button--docs');
    expect(restored.unattachedDocs.get('guide--docs')?.name).toBe('Guide');
  });

  it('uses distinct keys so concurrent list/show loads do not collide', () => {
    expect(docsClassificationKey('list', { withStoryIds: false })).toBe('list:0');
    expect(docsClassificationKey('list', { withStoryIds: true })).toBe('list:1');
    expect(docsClassificationKey('show', { id: 'button' })).toBe('show:button');
    expect(docsClassificationKey('show', { id: 'link' })).toBe('show:link');
    expect(docsClassificationKey('list', {})).not.toBe(docsClassificationKey('show', { id: 'x' }));
  });
});
