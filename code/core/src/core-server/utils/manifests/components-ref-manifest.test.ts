import { readFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { vol } from 'memfs';

import { docgenManifestRef } from '../../../shared/open-service/services/docgen/paths.ts';

import {
  COMPONENTS_REF_MANIFEST_VERSION,
  buildComponentsRefManifest,
  loadComponentManifestIndexEntriesFromDisk,
} from './components-ref-manifest.ts';

vi.mock('node:fs/promises', { spy: true });

beforeEach(async () => {
  vol.reset();
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');

  vi.mocked(readFile).mockImplementation(
    memfs.fs.promises.readFile as unknown as typeof import('node:fs/promises').readFile
  );
});

describe('components-ref-manifest', () => {
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

  it('carries meta when provided', () => {
    expect(
      buildComponentsRefManifest({}, { docgen: 'react-component-meta', durationMs: 42 })
    ).toEqual({
      v: COMPONENTS_REF_MANIFEST_VERSION,
      components: {},
      meta: { docgen: 'react-component-meta', durationMs: 42 },
    });
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
