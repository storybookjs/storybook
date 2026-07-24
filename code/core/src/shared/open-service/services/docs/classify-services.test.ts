import { describe, expect, it } from 'vitest';

import { classifyServices } from './classify-services.ts';

const storyDocsPayload = {
  id: 'button',
  name: 'Button',
  path: './Button.stories.tsx',
  stories: {
    'button--primary': {
      id: 'button--primary',
      name: 'Primary',
    },
  },
};

const attachedMdxPayload = {
  id: 'button',
  name: 'Button',
  docs: {
    'button--docs': {
      id: 'button--docs',
      name: 'Docs',
    },
  },
};

const unattachedMdxPayload = {
  id: 'introduction',
  name: 'Introduction',
  docs: {
    introduction: {
      id: 'introduction',
      name: 'Introduction',
    },
  },
};

describe('classifyServices', () => {
  it('uses service aggregate keys as the visibility source of truth', () => {
    const classification = classifyServices({
      allDocgen: {
        'docgen-only': {
          id: 'docgen-only',
          name: 'Docgen only',
          path: './DocgenOnly.tsx',
          jsDocTags: {},
        },
      },
      allStoryDocs: {},
      allMdx: {},
    });

    expect(classification.componentIds).toEqual(['docgen-only']);
    expect(classification.storyBasedIds).toEqual(new Set());
  });

  it('derives components and attached versus unattached docs from service payloads', () => {
    const classification = classifyServices({
      allDocgen: {
        button: {
          id: 'button',
          name: 'Button',
          path: './Button.tsx',
          jsDocTags: {},
        },
      },
      allStoryDocs: { button: storyDocsPayload },
      allMdx: {
        button: attachedMdxPayload,
        introduction: unattachedMdxPayload,
      },
    });

    expect(classification).toMatchObject({
      componentIds: ['button'],
      storyBasedIds: new Set(['button']),
      unattachedDocs: new Map([
        ['introduction', expect.objectContaining({ id: 'introduction', name: 'Introduction' })],
      ]),
    });
    expect(classification.attachedDocsByComponent.get('button')).toEqual([
      expect.objectContaining({ id: 'button--docs', name: 'Docs' }),
    ]);
  });
});
