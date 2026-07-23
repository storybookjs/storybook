import type { StoryIndex } from 'storybook/internal/types';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Tag } from '../../../constants/tags.ts';
import { invokeApi } from '../../../public-api/index.ts';
import { getService } from '../../server.ts';
import { createDocsApi } from './definition.ts';

vi.mock('../../server.ts', { spy: true });

const index = {
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
} as StoryIndex;

const docgenForAllComponents = vi.fn();
const docgen = vi.fn();
const storyDocs = vi.fn();
const mdxForAllComponents = vi.fn();
const mdxForComponent = vi.fn();

const services = {
  'core/docgen': {
    queries: {
      docgenForAllComponents: { loaded: docgenForAllComponents },
      docgen: { loaded: docgen },
    },
  },
  'core/story-docs': {
    queries: {
      storyDocs: { loaded: storyDocs },
    },
  },
  'addon-docs/mdx': {
    queries: {
      mdxForAllComponents: { loaded: mdxForAllComponents },
      mdxForComponent: { loaded: mdxForComponent },
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getService).mockImplementation(
    (id: string) => services[id as keyof typeof services] as never
  );
  docgenForAllComponents.mockResolvedValue({
    button: {
      id: 'button',
      name: 'Button',
      path: './Button.tsx',
      summary: 'A button',
      jsDocTags: {},
    },
  });
  docgen.mockResolvedValue({
    id: 'button',
    name: 'Button',
    path: './Button.tsx',
    description: 'Click me',
    jsDocTags: {},
  });
  storyDocs.mockResolvedValue({
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
  });
  mdxForAllComponents.mockResolvedValue({
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
  });
  mdxForComponent.mockResolvedValue(undefined);
});

describe('docs API', () => {
  it('returns compact Markdown by default after loading internal services', async () => {
    const docsApi = createDocsApi({ getIndex: async () => index });

    await expect(invokeApi(docsApi, 'list', { withStoryIds: true })).resolves.toBe(
      [
        '# Components',
        '- Button (button): A button',
        '  - button--primary',
        '',
        '# Docs',
        '- Getting started (guide--docs): Intro',
      ].join('\n')
    );
    expect(docgenForAllComponents).toHaveBeenCalledOnce();
    expect(storyDocs).toHaveBeenCalledWith({ id: 'button' });
    expect(mdxForAllComponents).toHaveBeenCalledOnce();
  });

  it('returns the existing structured mapper result with json true', async () => {
    const docsApi = createDocsApi({ getIndex: async () => index });

    await expect(invokeApi(docsApi, 'list', { withStoryIds: true, json: true })).resolves.toEqual({
      components: [
        { id: 'button', name: 'Button', summary: 'A button', storyIds: ['button--primary'] },
      ],
      docs: [{ id: 'guide--docs', name: 'Guide', title: 'Getting started', summary: 'Intro' }],
    });
  });

  it('formats component and story documentation while loading each dependency', async () => {
    const docsApi = createDocsApi({ getIndex: async () => index });

    await expect(invokeApi(docsApi, 'show', { id: 'button' })).resolves.toContain(
      '# Button\n\nClick me'
    );
    expect(docgen).toHaveBeenCalledWith({ id: 'button' });
    expect(storyDocs).toHaveBeenCalledWith({ id: 'button' });

    await expect(
      invokeApi(docsApi, 'showStory', {
        componentId: 'button',
        storyName: 'Primary',
      })
    ).resolves.toBe(
      [
        '# Button - Primary',
        '',
        '```',
        "import { Button } from './Button'",
        '',
        '<Button />',
        '```',
      ].join('\n')
    );
  });

  it('creates a definition containing only public API fields', () => {
    const docsApi = createDocsApi({ getIndex: async () => index });

    expect(Object.keys(docsApi)).toEqual(['id', 'description', 'methods']);
    for (const method of Object.values(docsApi.methods)) {
      expect(Object.keys(method).sort()).toEqual(['description', 'handler', 'schema']);
    }
  });
});
