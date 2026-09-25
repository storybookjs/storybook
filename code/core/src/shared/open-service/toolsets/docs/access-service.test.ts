import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IndexEntry, StoryIndex } from 'storybook/internal/types';

import {
  OpenServiceDocgenMissingComponentError,
  OpenServiceMissingServiceError,
} from '../../../../server-errors.ts';
import type { ToolsetGetService } from '../../toolset-definition.ts';
import { createServiceDocsAccess } from './access-service.ts';

const storyEntry = (id: string, name: string, tags: string[]): IndexEntry => ({
  type: 'story',
  subtype: 'story',
  id,
  name,
  title: id.split('--')[0],
  importPath: `./${id.split('--')[0]}.stories.tsx`,
  tags,
});

const docsEntry = (id: string, name: string, tags: string[], storiesImports: string[]) => ({
  type: 'docs' as const,
  id,
  name,
  title: id.split('--')[0],
  importPath: `./${id.split('--')[0]}.mdx`,
  storiesImports,
  tags,
});

// Deliberately not alphabetical: `zebra` before `alpha` proves component ids keep index order.
const fullIndex: StoryIndex = {
  v: 5,
  entries: {
    'zebra--primary': storyEntry('zebra--primary', 'Primary', ['manifest', 'dev']),
    'alpha--primary': storyEntry('alpha--primary', 'Primary', ['manifest']),
    'alpha--secondary': storyEntry('alpha--secondary', 'Secondary', ['manifest']),
    'untagged--primary': storyEntry('untagged--primary', 'Primary', ['dev']),
    'alpha--docs': docsEntry(
      'alpha--docs',
      'Alpha docs',
      ['manifest', 'attached-mdx'],
      ['./alpha.stories.tsx']
    ),
    'only-docs--docs': docsEntry(
      'only-docs--docs',
      'Only docs',
      ['manifest', 'attached-mdx'],
      ['./only-docs.stories.tsx']
    ),
    'guide--docs': docsEntry('guide--docs', 'Guide', ['manifest', 'unattached-mdx'], []),
    'untagged--docs': docsEntry('untagged--docs', 'Untagged', ['unattached-mdx'], []),
  },
};

const zebraDocgen = {
  id: 'zebra',
  name: 'Zebra',
  path: './zebra.tsx',
  description: 'Striped',
  summary: 'A zebra',
  jsDocTags: {},
};
const alphaDocgen = { id: 'alpha', name: 'Alpha', path: './alpha.tsx', jsDocTags: {} };
const alphaStoryDocs = {
  id: 'alpha',
  name: 'Alpha',
  path: './alpha.stories.tsx',
  import: "import { Alpha } from './alpha'",
  stories: {
    'alpha--primary': { id: 'alpha--primary', name: 'Primary', snippet: '<Alpha />' },
    'alpha--secondary': { id: 'alpha--secondary', name: 'Secondary' },
  },
};
const zebraStoryDocs = {
  id: 'zebra',
  name: 'Zebra',
  path: './zebra.stories.tsx',
  stories: { 'zebra--primary': { id: 'zebra--primary', name: 'Primary' } },
};
const alphaMdx = {
  id: 'alpha',
  name: 'Alpha',
  docs: {
    'alpha--docs': { id: 'alpha--docs', name: 'Alpha docs', content: '# Alpha', summary: 'Alpha!' },
  },
};
const onlyDocsMdx = {
  id: 'only-docs',
  name: 'Only docs',
  docs: { 'only-docs--docs': { id: 'only-docs--docs', name: 'Only docs', content: '# Only' } },
};
const guideMdx = {
  id: 'guide--docs',
  name: 'Guide',
  docs: {
    'guide--docs': {
      id: 'guide--docs',
      name: 'Guide',
      title: 'Getting started',
      content: '# Guide',
      summary: 'Intro',
    },
  },
};

const docgenForAllComponents = vi.fn();
const docgen = vi.fn();
const storyDocs = vi.fn();
const mdxForAllComponents = vi.fn();
const mdxForComponent = vi.fn();

const services: Record<string, unknown> = {
  'core/docgen': {
    queries: {
      docgenForAllComponents: { loaded: docgenForAllComponents },
      docgen: { loaded: docgen },
    },
  },
  'core/story-docs': { queries: { storyDocs: { loaded: storyDocs } } },
  'addon-docs/mdx': {
    queries: {
      mdxForAllComponents: { loaded: mdxForAllComponents },
      mdxForComponent: { loaded: mdxForComponent },
    },
  },
};

let index: StoryIndex;
let mdxAvailable: boolean;
let getService: ToolsetGetService;

const createAccess = () =>
  createServiceDocsAccess({
    storyIndex: { getIndex: async () => index },
    getService,
  });

beforeEach(() => {
  vi.clearAllMocks();
  index = fullIndex;
  mdxAvailable = true;
  getService = vi.fn((id: string) => {
    if (id === 'addon-docs/mdx' && !mdxAvailable) {
      throw new OpenServiceMissingServiceError({ serviceId: 'addon-docs/mdx' });
    }
    return services[id];
  }) as ToolsetGetService;

  docgenForAllComponents.mockResolvedValue({ zebra: zebraDocgen, alpha: alphaDocgen });
  mdxForAllComponents.mockResolvedValue({ 'guide--docs': guideMdx });
  // The real per-id loads reject for ids with no component entry in the index.
  const componentPayloads: Record<string, Record<string, unknown>> = {
    alpha: alphaStoryDocs,
    zebra: zebraStoryDocs,
  };
  storyDocs.mockImplementation(async ({ id }: { id: string }) => {
    if (!componentPayloads[id]) {
      throw new OpenServiceDocgenMissingComponentError({ id });
    }
    return componentPayloads[id];
  });
  docgen.mockImplementation(async ({ id }: { id: string }) => {
    if (id === 'alpha') {
      return alphaDocgen;
    }
    if (id === 'zebra') {
      return zebraDocgen;
    }
    throw new OpenServiceDocgenMissingComponentError({ id });
  });
  mdxForComponent.mockImplementation(async ({ id }: { id: string }) => {
    const payloads: Record<string, unknown> = {
      alpha: alphaMdx,
      'only-docs': onlyDocsMdx,
      'guide--docs': guideMdx,
    };
    return payloads[id];
  });
});

describe('createServiceDocsAccess list', () => {
  it('lists manifest-tagged components in story-index order', async () => {
    const manifests = await createAccess().list({ withStoryIds: false });

    expect(Object.keys(manifests.componentManifest.components)).toEqual([
      'zebra',
      'alpha',
      'only-docs',
    ]);
    expect(manifests.componentManifest.components.zebra).toEqual({
      id: 'zebra',
      name: 'Zebra',
      description: 'Striped',
      summary: 'A zebra',
    });
    // No docgen payload yet: the id stands in for the name.
    expect(manifests.componentManifest.components['only-docs']).toEqual({
      id: 'only-docs',
      name: 'only-docs',
    });
  });

  it('omits untagged entries from both manifests', async () => {
    const manifests = await createAccess().list({ withStoryIds: false });

    expect(manifests.componentManifest.components).not.toHaveProperty('untagged');
    expect(manifests.docsManifest?.docs).not.toHaveProperty('untagged--docs');
  });

  it('skips story-docs entirely when story ids are not requested', async () => {
    const manifests = await createAccess().list({ withStoryIds: false });

    expect(storyDocs).not.toHaveBeenCalled();
    expect(manifests.componentManifest.components.alpha).not.toHaveProperty('stories');
  });

  it('resolves story ids per component id when they are requested', async () => {
    const manifests = await createAccess().list({ withStoryIds: true });

    expect(manifests.componentManifest.components.alpha?.stories).toEqual([
      { id: 'alpha--primary', name: 'Primary', snippet: '<Alpha />' },
      { id: 'alpha--secondary', name: 'Secondary' },
    ]);
    expect(storyDocs).toHaveBeenCalledWith({ id: 'alpha' });
    expect(storyDocs).toHaveBeenCalledWith({ id: 'zebra' });
    // A docs-only component has no stories to resolve.
    expect(storyDocs).not.toHaveBeenCalledWith({ id: 'only-docs' });
    expect(manifests.componentManifest.components['only-docs']).not.toHaveProperty('stories');
  });

  it('names standalone docs from the index and summarizes them from MDX', async () => {
    const manifests = await createAccess().list({ withStoryIds: false });

    expect(manifests.docsManifest).toEqual({
      v: 1,
      docs: { 'guide--docs': { id: 'guide--docs', name: 'Guide', summary: 'Intro' } },
    });
  });

  it('still lists standalone docs when the MDX service is not registered', async () => {
    mdxAvailable = false;

    const manifests = await createAccess().list({ withStoryIds: false });

    expect(manifests.docsManifest).toEqual({
      v: 1,
      docs: { 'guide--docs': { id: 'guide--docs', name: 'Guide' } },
    });
  });

  it('omits the docs manifest, and the MDX load, when there are no standalone docs', async () => {
    index = {
      v: 5,
      entries: { 'alpha--primary': fullIndex.entries['alpha--primary'] },
    };

    const manifests = await createAccess().list({ withStoryIds: false });

    expect(manifests.docsManifest).toBeUndefined();
    expect(mdxForAllComponents).not.toHaveBeenCalled();
  });
});

describe('createServiceDocsAccess resolve', () => {
  it('assembles a component from docgen, story docs, and attached MDX', async () => {
    const entry = await createAccess().resolve('alpha');

    expect(entry).toMatchObject({
      kind: 'component',
      component: {
        id: 'alpha',
        name: 'Alpha',
        import: "import { Alpha } from './alpha'",
        stories: [
          { id: 'alpha--primary', name: 'Primary', snippet: '<Alpha />' },
          { id: 'alpha--secondary', name: 'Secondary' },
        ],
        docs: { 'alpha--docs': { id: 'alpha--docs', content: '# Alpha' } },
      },
    });
    expect(docgen).toHaveBeenCalledWith({ id: 'alpha' });
    expect(mdxForAllComponents).not.toHaveBeenCalled();
  });

  it('resolves a component whose payloads are absent, falling back to the id', async () => {
    const entry = await createAccess().resolve('only-docs');

    expect(entry).toMatchObject({
      kind: 'component',
      component: {
        id: 'only-docs',
        name: 'only-docs',
        docs: { 'only-docs--docs': { id: 'only-docs--docs', content: '# Only' } },
      },
    });
  });

  it('resolves a standalone docs entry', async () => {
    const entry = await createAccess().resolve('guide--docs');

    expect(entry).toEqual({
      kind: 'doc',
      doc: {
        id: 'guide--docs',
        name: 'Guide',
        title: 'Getting started',
        content: '# Guide',
        summary: 'Intro',
      },
    });
  });

  it('returns undefined for ids the index does not know, without touching the services', async () => {
    await expect(createAccess().resolve('nope')).resolves.toBeUndefined();
    expect(docgen).not.toHaveBeenCalled();
    expect(storyDocs).not.toHaveBeenCalled();
    expect(mdxForComponent).not.toHaveBeenCalled();
  });

  it('returns undefined for a standalone doc whose MDX service is not registered', async () => {
    mdxAvailable = false;

    await expect(createAccess().resolve('guide--docs')).resolves.toBeUndefined();
  });
});
