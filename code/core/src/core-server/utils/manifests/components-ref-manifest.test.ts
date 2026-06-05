import { readFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { vol } from 'memfs';

import { docgenManifestRef } from '../../../shared/open-service/services/docgen/paths.ts';
import type { DocgenPayload } from '../../../shared/open-service/services/docgen/types.ts';

import {
  COMPONENTS_REF_MANIFEST_VERSION,
  buildComponentsRefManifest,
  loadDocgenPayloadsFromDisk,
  toComponentManifestIndexEntries,
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

  it('loads full docgen payloads from built snapshots on disk', async () => {
    const payload = {
      id: 'button',
      name: 'Button',
      description: 'A button',
      summary: 'Click me',
      path: './button.stories.tsx',
      jsDocTags: {},
      stories: [],
    };
    vol.fromNestedJSON({
      '/output/services/core/docgen/button.json': JSON.stringify({
        components: { button: payload },
      }),
    });

    await expect(loadDocgenPayloadsFromDisk('/output', ['button'])).resolves.toEqual({
      button: payload,
    });
  });

  it('skips components without a readable snapshot', async () => {
    await expect(loadDocgenPayloadsFromDisk('/output', ['button'])).resolves.toEqual({});
  });

  it('builds index entries with a nested docgen ref when a payload exists', () => {
    const payload: DocgenPayload = {
      id: 'button',
      name: 'Button',
      description: 'A button',
      summary: 'Click me',
      path: './button.stories.tsx',
      jsDocTags: {},
      stories: [],
    };

    expect(toComponentManifestIndexEntries(['button'], { button: payload })).toEqual({
      button: {
        id: 'button',
        name: 'Button',
        description: 'A button',
        summary: 'Click me',
        docgen: { $ref: docgenManifestRef('button') },
      },
    });
  });

  it('builds a minimal index entry (no docgen ref) when a payload is missing', () => {
    expect(toComponentManifestIndexEntries(['button'], {})).toEqual({
      button: { id: 'button', name: 'button' },
    });
  });
});
