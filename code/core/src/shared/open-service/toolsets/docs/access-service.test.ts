import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  OpenServiceDocgenMissingComponentError,
  OpenServiceMissingServiceError,
} from '../../../../server-errors.ts';
import type { ManifestEntries } from '../../services/docgen/definition.ts';
import type { ToolsetGetService } from '../../toolset-definition.ts';
import { createServiceDocsAccess } from './access-service.ts';

// Deliberately not alphabetical: `zebra` before `alpha` proves component ids keep the server's order.
const fullManifestEntries: ManifestEntries = {
  componentIds: ['zebra', 'alpha', 'only-docs'],
  docs: [{ id: 'guide--docs', name: 'Guide' }],
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

const manifestEntries = vi.fn();
const docgenForAllComponents = vi.fn();
const docgen = vi.fn();
const storyDocs = vi.fn();
const mdxForAllComponents = vi.fn();
const mdxForComponent = vi.fn();

const services: Record<string, unknown> = {
  'core/docgen': {
    queries: {
      manifestEntries: { loaded: manifestEntries },
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

let mdxAvailable: boolean;
let getService: ToolsetGetService;

const createAccess = () => createServiceDocsAccess({ getService });

beforeEach(() => {
  vi.clearAllMocks();
  mdxAvailable = true;
  getService = vi.fn((id: string) => {
    if (id === 'addon-docs/mdx' && !mdxAvailable) {
      throw new OpenServiceMissingServiceError({ serviceId: 'addon-docs/mdx' });
    }
    return services[id];
  }) as ToolsetGetService;

  manifestEntries.mockResolvedValue(fullManifestEntries);
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
  it('lists the published component ids in the order the server gives them', async () => {
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

  it('lists only what the server published, whatever else was extracted', async () => {
    docgenForAllComponents.mockResolvedValue({
      zebra: zebraDocgen,
      alpha: alphaDocgen,
      untagged: { id: 'untagged', name: 'Untagged', path: './untagged.tsx', jsDocTags: {} },
    });

    const manifests = await createAccess().list({ withStoryIds: false });

    expect(manifests.componentManifest.components).not.toHaveProperty('untagged');
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
    // A docs-only component resolves to no stories, like the manifest it mirrors.
    expect(manifests.componentManifest.components['only-docs']?.stories).toEqual([]);
  });

  it('names standalone docs from the server and summarizes them from MDX', async () => {
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
    manifestEntries.mockResolvedValue({ componentIds: ['alpha'], docs: [] });

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
    expect(docgenForAllComponents).not.toHaveBeenCalled();
    expect(mdxForAllComponents).not.toHaveBeenCalled();
  });

  it('omits docs for a component without attached MDX', async () => {
    const entry = await createAccess().resolve('zebra');

    expect(entry).toMatchObject({ kind: 'component', component: { id: 'zebra', name: 'Zebra' } });
    expect(entry).not.toMatchObject({ component: { docs: expect.anything() } });
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

  it('returns undefined for ids the server does not publish, without touching the payloads', async () => {
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
