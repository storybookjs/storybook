import { describe, expect, it } from 'vitest';

import type { DocsIndexEntry, IndexEntry } from 'storybook/internal/types';

import { experimental_manifests } from './manifest';

describe('experimental_manifests', () => {
  it('should return existing manifests when no MDX entries are found', async () => {
    const existingManifests = { components: { v: 0, components: {} } };
    const manifestEntries: IndexEntry[] = [
      {
        id: 'example--story',
        name: 'Story',
        title: 'Example',
        type: 'story',
        subtype: 'story',
        importPath: './Example.stories.tsx',
        tags: ['manifest'],
      },
    ];

    const result = await experimental_manifests(existingManifests, { manifestEntries });

    expect(result).toEqual(existingManifests);
  });

  it('should generate MDX manifest for attached-mdx entries', async () => {
    const existingManifests = {};
    const manifestEntries: IndexEntry[] = [
      {
        id: 'example--docs',
        name: 'docs',
        title: 'Example',
        type: 'docs',
        importPath: './Example.mdx',
        tags: ['manifest', 'attached-mdx'],
        storiesImports: ['./Example.stories.tsx'],
      } satisfies DocsIndexEntry,
    ];

    const result = await experimental_manifests(existingManifests, { manifestEntries });

    expect(result).toHaveProperty('mdx');
    expect(result.mdx).toEqual({
      v: 0,
      entries: {
        'example--docs': {
          id: 'example--docs',
          name: 'docs',
          path: './Example.mdx',
          title: 'Example',
          tags: ['manifest', 'attached-mdx'],
          storiesImports: ['./Example.stories.tsx'],
        },
      },
    });
  });

  it('should generate MDX manifest for unattached-mdx entries', async () => {
    const existingManifests = {};
    const manifestEntries: IndexEntry[] = [
      {
        id: 'standalone--docs',
        name: 'docs',
        title: 'Standalone',
        type: 'docs',
        importPath: './Standalone.mdx',
        tags: ['manifest', 'unattached-mdx'],
        storiesImports: [],
      } satisfies DocsIndexEntry,
    ];

    const result = await experimental_manifests(existingManifests, { manifestEntries });

    expect(result).toHaveProperty('mdx');
    expect(result.mdx).toEqual({
      v: 0,
      entries: {
        'standalone--docs': {
          id: 'standalone--docs',
          name: 'docs',
          path: './Standalone.mdx',
          title: 'Standalone',
          tags: ['manifest', 'unattached-mdx'],
          storiesImports: [],
        },
      },
    });
  });

  it('should include multiple MDX entries in the manifest', async () => {
    const existingManifests = {};
    const manifestEntries: IndexEntry[] = [
      {
        id: 'example--docs',
        name: 'docs',
        title: 'Example',
        type: 'docs',
        importPath: './Example.mdx',
        tags: ['manifest', 'attached-mdx'],
        storiesImports: ['./Example.stories.tsx'],
      } satisfies DocsIndexEntry,
      {
        id: 'standalone--docs',
        name: 'docs',
        title: 'Standalone',
        type: 'docs',
        importPath: './Standalone.mdx',
        tags: ['manifest', 'unattached-mdx'],
        storiesImports: [],
      } satisfies DocsIndexEntry,
    ];

    const result = await experimental_manifests(existingManifests, { manifestEntries });

    expect(result).toHaveProperty('mdx');
    expect(result.mdx.entries).toHaveProperty('example--docs');
    expect(result.mdx.entries).toHaveProperty('standalone--docs');
    expect(Object.keys(result.mdx.entries)).toHaveLength(2);
  });

  it('should exclude MDX entries without manifest tag', async () => {
    const existingManifests = {};
    const manifestEntries: IndexEntry[] = [
      {
        id: 'example--docs',
        name: 'docs',
        title: 'Example',
        type: 'docs',
        importPath: './Example.mdx',
        tags: ['attached-mdx'], // No 'manifest' tag
        storiesImports: ['./Example.stories.tsx'],
      } satisfies DocsIndexEntry,
    ];

    const result = await experimental_manifests(existingManifests, { manifestEntries });

    expect(result).toEqual(existingManifests);
  });

  it('should exclude docs entries without attached-mdx or unattached-mdx tags', async () => {
    const existingManifests = {};
    const manifestEntries: IndexEntry[] = [
      {
        id: 'example--docs',
        name: 'docs',
        title: 'Example',
        type: 'docs',
        importPath: './Example.mdx',
        tags: ['manifest', 'autodocs'], // Has manifest but not attached/unattached-mdx
        storiesImports: ['./Example.stories.tsx'],
      } satisfies DocsIndexEntry,
    ];

    const result = await experimental_manifests(existingManifests, { manifestEntries });

    expect(result).toEqual(existingManifests);
  });

  it('should preserve existing manifests', async () => {
    const existingManifests = {
      components: { v: 0, components: { 'example-component': { id: 'example-component' } } },
    };
    const manifestEntries: IndexEntry[] = [
      {
        id: 'example--docs',
        name: 'docs',
        title: 'Example',
        type: 'docs',
        importPath: './Example.mdx',
        tags: ['manifest', 'attached-mdx'],
        storiesImports: ['./Example.stories.tsx'],
      } satisfies DocsIndexEntry,
    ];

    const result = await experimental_manifests(existingManifests, { manifestEntries });

    expect(result).toHaveProperty('components');
    expect(result).toHaveProperty('mdx');
    expect(result.components).toEqual(existingManifests.components);
  });

  it('should handle entries with all tag variations', async () => {
    const existingManifests = {};
    const manifestEntries: IndexEntry[] = [
      {
        id: 'example--docs',
        name: 'docs',
        title: 'Example',
        type: 'docs',
        importPath: './Example.mdx',
        tags: ['dev', 'test', 'manifest', 'attached-mdx'],
        storiesImports: ['./Example.stories.tsx'],
      } satisfies DocsIndexEntry,
    ];

    const result = await experimental_manifests(existingManifests, { manifestEntries });

    expect(result.mdx.entries['example--docs'].tags).toEqual([
      'dev',
      'test',
      'manifest',
      'attached-mdx',
    ]);
  });

  it('should handle entries without tags array', async () => {
    const existingManifests = {};
    const manifestEntries: IndexEntry[] = [
      {
        id: 'example--docs',
        name: 'docs',
        title: 'Example',
        type: 'docs',
        importPath: './Example.mdx',
        storiesImports: ['./Example.stories.tsx'],
      } satisfies DocsIndexEntry,
    ];

    const result = await experimental_manifests(existingManifests, { manifestEntries });

    expect(result).toEqual(existingManifests);
  });
});
