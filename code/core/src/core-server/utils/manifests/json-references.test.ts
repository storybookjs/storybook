import { readFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { vol } from 'memfs';

import { docgenManifestRef } from '../../../shared/open-service/services/docgen/paths.ts';
import type { DocgenPayload } from '../../../shared/open-service/services/docgen/types.ts';

import {
  COMPONENTS_REF_MANIFEST_VERSION,
  buildComponentsRefManifest,
  dereferenceComponentsManifest,
  followJsonReferences,
  loadComponentManifestIndexEntriesFromDisk,
  parseJsonPointer,
  resolveJsonPointer,
} from './json-references.ts';

vi.mock('node:fs/promises', { spy: true });

beforeEach(async () => {
  vol.reset();
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');

  vi.mocked(readFile).mockImplementation(
    memfs.fs.promises.readFile as unknown as typeof import('node:fs/promises').readFile
  );
});

describe('json-references', () => {
  it('parses and resolves JSON pointers', () => {
    const doc = { components: { button: { name: 'Button' } } };

    expect(parseJsonPointer('/components/button')).toEqual(['components', 'button']);
    expect(resolveJsonPointer(doc, '/components/button')).toEqual({ name: 'Button' });
  });

  it('builds ref-based component manifest entries with nested docgen refs', () => {
    expect(
      buildComponentsRefManifest({
        button: {
          id: 'button',
          name: 'Button',
          docgen: { $ref: docgenManifestRef('button') },
        },
        card: {
          id: 'card',
          name: 'Card',
          summary: 'A card',
        },
      })
    ).toEqual({
      v: COMPONENTS_REF_MANIFEST_VERSION,
      components: {
        button: {
          id: 'button',
          name: 'Button',
          docgen: { $ref: docgenManifestRef('button') },
        },
        card: {
          id: 'card',
          name: 'Card',
          summary: 'A card',
        },
      },
    });
  });

  it('follows nested docgen refs via an injected resolver', () => {
    const payload: DocgenPayload = {
      id: 'button',
      name: 'Button',
      path: './button.stories.tsx',
      jsDocTags: {},
      stories: [],
    };
    const store: Record<string, unknown> = {
      '../services/core/docgen/button.json': { components: { button: payload } },
    };

    const refManifest = buildComponentsRefManifest({
      button: {
        id: 'button',
        name: 'Button',
        docgen: { $ref: docgenManifestRef('button') },
      },
    });
    const resolved = followJsonReferences(refManifest, (filePath) => {
      const doc = store[filePath];
      if (!doc) {
        throw new Error(`missing ${filePath}`);
      }
      return doc;
    });

    expect(resolved.components.button).toEqual({
      id: 'button',
      name: 'Button',
      docgen: payload,
    });
  });

  it('dereferences nested refs into a components manifest', () => {
    const payload: DocgenPayload = {
      id: 'button',
      name: 'Button',
      path: './button.stories.tsx',
      description: 'A button',
      jsDocTags: {},
      stories: [],
      reactComponentMeta: {
        filePath: './Button.tsx',
        exportName: 'Button',
        props: {
          label: {
            name: 'label',
            required: false,
            type: { name: 'string' },
            description: '',
            defaultValue: null,
          },
        },
      },
    };
    const store: Record<string, unknown> = {
      '../services/core/docgen/button.json': { components: { button: payload } },
    };

    const manifest = dereferenceComponentsManifest(
      buildComponentsRefManifest(
        {
          button: {
            id: 'button',
            name: 'Button',
            description: 'A button',
            docgen: { $ref: docgenManifestRef('button') },
          },
        },
        { docgen: 'react-component-meta', durationMs: 42 }
      ),
      (filePath) => {
        return store[filePath];
      }
    );

    expect(manifest.v).toBe(COMPONENTS_REF_MANIFEST_VERSION);
    expect(manifest.components.button).toMatchObject({
      id: 'button',
      name: 'Button',
      description: 'A button',
    });
    expect(manifest.meta?.docgen).toBe('react-component-meta');
    expect(manifest.meta?.durationMs).toBe(42);
  });

  it('loads index entries from built docgen snapshots on disk', async () => {
    vol.fromNestedJSON({
      '/output/services/core/docgen/button.json': JSON.stringify({
        components: {
          button: {
            id: 'button',
            name: 'Button',
            description: 'A button',
            summary: 'Click me',
            path: './button.stories.tsx',
            jsDocTags: {},
            stories: [],
          },
        },
      }),
    });

    await expect(
      loadComponentManifestIndexEntriesFromDisk('/output', ['button'])
    ).resolves.toEqual({
      button: {
        id: 'button',
        name: 'Button',
        description: 'A button',
        summary: 'Click me',
        docgen: { $ref: docgenManifestRef('button') },
      },
    });
  });

  it('omits docgen ref when the snapshot is missing', async () => {
    await expect(
      loadComponentManifestIndexEntriesFromDisk('/output', ['button'])
    ).resolves.toEqual({
      button: {
        id: 'button',
        name: 'button',
      },
    });
  });
});
