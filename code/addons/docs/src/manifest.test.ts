import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Tag } from 'storybook/internal/core-server';
import type { DocsIndexEntry, IndexEntry } from 'storybook/internal/types';

import { vol } from 'memfs';

import type { DocsManifestEntry } from './manifest';
import { manifests } from './manifest';

vi.mock('node:fs/promises', async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  return memfs.fs.promises;
});

beforeEach(() => {
  vi.spyOn(process, 'cwd').mockReturnValue('/app');
  vol.fromJSON(
    {
      './Example.mdx': `import { Meta } from '@storybook/addon-docs/blocks';

<Meta summary="An example documentation page" />

# Example

This is example documentation.`,
      './Standalone.mdx': `import { Meta } from '@storybook/addon-docs/blocks';

<Meta summary="A standalone documentation page" />

# Standalone

This is standalone documentation.`,
    },
    '/app'
  );
});

interface DocsManifest {
  v: number;
  docs: Record<string, DocsManifestEntry>;
}

interface ComponentManifestWithDocs {
  id: string;
  path: string;
  name: string;
  stories: unknown[];
  jsDocTags: Record<string, unknown>;
  docs?: Record<string, DocsManifestEntry>;
}

interface ComponentsManifestWithDocs {
  v: number;
  components: Record<string, ComponentManifestWithDocs>;
}

interface ManifestResult {
  docs?: DocsManifest;
  components?: ComponentsManifestWithDocs;
}

describe('experimental_manifests', () => {
  it('should return existing manifests when no docs entries are found', async () => {
    const existingManifests = {
      components: {
        v: 0,
        components: {
          'example-component': {
            id: 'example-component',
            path: './Example.stories.tsx',
            name: 'Example',
            stories: [],
            jsDocTags: {},
          },
        },
      },
    };
    const manifestEntries: IndexEntry[] = [
      {
        id: 'example--story',
        name: 'Story',
        title: 'Example',
        type: 'story',
        subtype: 'story',
        importPath: './Example.stories.tsx',
        tags: [Tag.MANIFEST],
      },
    ];

    const result = (await manifests(existingManifests, {
      manifestEntries,
    } as any)) as ManifestResult;

    expect(result).toEqual(existingManifests);
  });

  it('should drop docs entries without attached-mdx or unattached-mdx tags', async () => {
    const existingManifests = {
      components: {
        v: 0,
        components: {
          example: {
            id: 'example',
            path: './Example.stories.tsx',
            name: 'Example',
            stories: [],
            jsDocTags: {},
          },
        },
      },
    };
    const manifestEntries: IndexEntry[] = [
      {
        id: 'example--docs',
        name: 'docs',
        title: 'Example',
        type: 'docs',
        importPath: './Example.mdx',
        tags: [Tag.MANIFEST, Tag.AUTODOCS], // No attached-mdx or unattached-mdx tag
        storiesImports: ['./Example.stories.tsx'],
      } satisfies DocsIndexEntry,
    ];

    const result = (await manifests(existingManifests, {
      manifestEntries,
    } as any)) as ManifestResult;

    // Should return existing manifests unchanged since docs entry was dropped
    expect(result).toEqual(existingManifests);
    expect(result.components?.components.example.docs).toBeUndefined();
  });

  it('should add attached docs entries to component manifests', async () => {
    const existingManifests = {
      components: {
        v: 0,
        components: {
          example: {
            id: 'example',
            path: './Example.stories.tsx',
            name: 'Example',
            stories: [],
            jsDocTags: {},
          },
        },
      },
    };
    const manifestEntries: IndexEntry[] = [
      {
        id: 'example--docs',
        name: 'docs',
        title: 'Example',
        type: 'docs',
        importPath: './Example.mdx',
        tags: [Tag.MANIFEST, Tag.ATTACHED_MDX],
        storiesImports: ['./Example.stories.tsx'],
      } satisfies DocsIndexEntry,
    ];

    const result = (await manifests(existingManifests, {
      manifestEntries,
    } as any)) as ManifestResult;

    expect(result).toHaveProperty('components');
    expect(result).not.toHaveProperty('docs');
    expect(result.components?.components.example.docs?.['example--docs']).toMatchObject({
      id: 'example--docs',
      name: 'docs',
      path: './Example.mdx',
      title: 'Example',
      summary: 'An example documentation page',
    });
    expect(result.components?.components.example.docs?.['example--docs'].content).toContain('This is example documentation.');
  });

  it('should generate docs manifest for unattached-mdx entries', async () => {
    const manifestEntries: IndexEntry[] = [
      {
        id: 'standalone--docs',
        name: 'docs',
        title: 'Standalone',
        type: 'docs',
        importPath: './Standalone.mdx',
        tags: [Tag.MANIFEST, Tag.UNATTACHED_MDX],
        storiesImports: [],
      } satisfies DocsIndexEntry,
    ];

    const result = (await manifests(undefined, { manifestEntries } as any)) as ManifestResult;

    expect(result).toHaveProperty('docs');
    expect(result.docs?.docs['standalone--docs']).toMatchObject({
      id: 'standalone--docs',
      name: 'docs',
      path: './Standalone.mdx',
      title: 'Standalone',
      summary: 'A standalone documentation page',
    });
    expect(result.docs?.docs['standalone--docs'].content).toContain('This is standalone documentation.');
  });

  it('should handle both attached and unattached docs entries separately', async () => {
    const existingManifests = {
      components: {
        v: 0,
        components: {
          example: {
            id: 'example',
            path: './Example.stories.tsx',
            name: 'Example',
            stories: [],
            jsDocTags: {},
          },
        },
      },
    };
    const manifestEntries: IndexEntry[] = [
      {
        id: 'example--docs',
        name: 'docs',
        title: 'Example',
        type: 'docs',
        importPath: './Example.mdx',
        tags: [Tag.MANIFEST, Tag.ATTACHED_MDX],
        storiesImports: ['./Example.stories.tsx'],
      } satisfies DocsIndexEntry,
      {
        id: 'standalone--docs',
        name: 'docs',
        title: 'Standalone',
        type: 'docs',
        importPath: './Standalone.mdx',
        tags: [Tag.MANIFEST, Tag.UNATTACHED_MDX],
        storiesImports: [],
      } satisfies DocsIndexEntry,
    ];

    const result = (await manifests(existingManifests, {
      manifestEntries,
    } as any)) as ManifestResult;

    // Unattached docs should be in the docs manifest
    expect(result).toHaveProperty('docs');
    expect(result.docs?.docs).toHaveProperty('standalone--docs');
    expect(Object.keys(result.docs?.docs ?? {})).toHaveLength(1);
    expect(result.docs?.docs['standalone--docs'].content).toContain(
      'This is standalone documentation.'
    );
    expect(result.docs?.docs['standalone--docs'].summary).toBe('A standalone documentation page');

    // Attached docs should be in the component manifest
    expect(result.components?.components.example.docs?.['example--docs']).toMatchObject({
      id: 'example--docs',
      name: 'docs',
      path: './Example.mdx',
      title: 'Example',
      summary: 'An example documentation page',
    });
    expect(result.components?.components.example.docs?.['example--docs'].content).toContain('This is example documentation.');
  });

  it('should preserve existing manifests and add unattached docs', async () => {
    const existingManifests = {
      components: {
        v: 0,
        components: {
          example: {
            id: 'example',
            path: './Example.stories.tsx',
            name: 'Example',
            stories: [],
            jsDocTags: {},
          },
        },
      },
    };
    const manifestEntries: IndexEntry[] = [
      {
        id: 'standalone--docs',
        name: 'docs',
        title: 'Standalone',
        type: 'docs',
        importPath: './Standalone.mdx',
        tags: [Tag.MANIFEST, Tag.UNATTACHED_MDX],
        storiesImports: [],
      } satisfies DocsIndexEntry,
    ];

    const result = (await manifests(existingManifests, {
      manifestEntries,
    } as any)) as ManifestResult;

    expect(result).toHaveProperty('components');
    expect(result).toHaveProperty('docs');
    // Components should be preserved (no docs added since no attached docs entries)
    expect(result.components?.components.example.docs).toBeUndefined();
  });

  it('should include error when file cannot be read for unattached docs', async () => {
    const manifestEntries: IndexEntry[] = [
      {
        id: 'missing--docs',
        name: 'docs',
        title: 'Missing',
        type: 'docs',
        importPath: './NonExistent.mdx',
        tags: [Tag.MANIFEST, Tag.UNATTACHED_MDX],
        storiesImports: [],
      } satisfies DocsIndexEntry,
    ];

    const result = (await manifests(undefined, { manifestEntries } as any)) as ManifestResult;

    expect(result).toHaveProperty('docs');
    expect(result.docs?.docs['missing--docs']).toEqual({
      id: 'missing--docs',
      name: 'docs',
      path: './NonExistent.mdx',
      title: 'Missing',
      error: {
        name: 'Error',
        message: expect.stringContaining('ENOENT'),
      },
    });
    expect(result.docs?.docs['missing--docs'].content).toBeUndefined();
  });

  it('should handle mixed success and error entries for unattached docs', async () => {
    const manifestEntries: IndexEntry[] = [
      {
        id: 'standalone--docs',
        name: 'docs',
        title: 'Standalone',
        type: 'docs',
        importPath: './Standalone.mdx',
        tags: [Tag.MANIFEST, Tag.UNATTACHED_MDX],
        storiesImports: [],
      } satisfies DocsIndexEntry,
      {
        id: 'missing--docs',
        name: 'docs',
        title: 'Missing',
        type: 'docs',
        importPath: './NonExistent.mdx',
        tags: [Tag.MANIFEST, Tag.UNATTACHED_MDX],
        storiesImports: [],
      } satisfies DocsIndexEntry,
    ];

    const result = (await manifests(undefined, { manifestEntries } as any)) as ManifestResult;

    expect(result).toHaveProperty('docs');
    expect(Object.keys(result.docs?.docs ?? {})).toHaveLength(2);

    // Successful entry
    expect(result.docs?.docs['standalone--docs'].content).toContain(
      'This is standalone documentation.'
    );
    expect(result.docs?.docs['standalone--docs'].summary).toBe('A standalone documentation page');
    expect(result.docs?.docs['standalone--docs'].error).toBeUndefined();

    // Failed entry
    expect(result.docs?.docs['missing--docs'].content).toBeUndefined();
    expect(result.docs?.docs['missing--docs'].error).toEqual({
      name: 'Error',
      message: expect.stringContaining('ENOENT'),
    });
  });

  it('should include summary in unattached docs entries when available', async () => {
    const manifestEntries: IndexEntry[] = [
      {
        id: 'standalone--docs',
        name: 'docs',
        title: 'Standalone',
        type: 'docs',
        importPath: './Standalone.mdx',
        tags: [Tag.MANIFEST, Tag.UNATTACHED_MDX],
        storiesImports: [],
      } satisfies DocsIndexEntry,
    ];

    const result = (await manifests(undefined, { manifestEntries } as any)) as ManifestResult;

    expect(result).toHaveProperty('docs');
    expect(result.docs?.docs['standalone--docs'].summary).toBe('A standalone documentation page');
  });

  it('should include summary in attached docs entries when available', async () => {
    const existingManifests = {
      components: {
        v: 0,
        components: {
          example: {
            id: 'example',
            path: './Example.stories.tsx',
            name: 'Example',
            stories: [],
            jsDocTags: {},
          },
        },
      },
    };
    const manifestEntries: IndexEntry[] = [
      {
        id: 'example--docs',
        name: 'docs',
        title: 'Example',
        type: 'docs',
        importPath: './Example.mdx',
        tags: [Tag.MANIFEST, Tag.ATTACHED_MDX],
        storiesImports: ['./Example.stories.tsx'],
      } satisfies DocsIndexEntry,
    ];

    const result = (await manifests(existingManifests, {
      manifestEntries,
    } as any)) as ManifestResult;

    expect(result.components?.components.example.docs?.['example--docs'].summary).toBe(
      'An example documentation page'
    );
  });

  it('should not include summary property when analyze returns no summary', async () => {
    vol.fromJSON(
      {
        './NoSummary.mdx': '# No Summary\n\nThis content has no summary.',
      },
      '/app'
    );

    const manifestEntries: IndexEntry[] = [
      {
        id: 'nosummary--docs',
        name: 'docs',
        title: 'NoSummary',
        type: 'docs',
        importPath: './NoSummary.mdx',
        tags: [Tag.MANIFEST, Tag.UNATTACHED_MDX],
        storiesImports: [],
      } satisfies DocsIndexEntry,
    ];

    const result = (await manifests(undefined, { manifestEntries } as any)) as ManifestResult;

    expect(result).toHaveProperty('docs');
    expect(result.docs?.docs['nosummary--docs'].content).toBe(
      '# No Summary\n\nThis content has no summary.'
    );
    expect(result.docs?.docs['nosummary--docs'].summary).toBeUndefined();
  });
});
