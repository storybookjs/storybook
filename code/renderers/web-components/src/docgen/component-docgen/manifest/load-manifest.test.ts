import { readFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fs as memfs, vol } from 'memfs';

import type { ManifestLoadResult } from './load-manifest.ts';
import { loadManifest } from './load-manifest.ts';

vi.mock('node:fs/promises', { spy: true });

beforeEach(() => {
  vol.reset();
  vi.mocked(readFile).mockImplementation(memfs.promises.readFile as typeof readFile);
});

const cem = {
  schemaVersion: '1.0.0',
  modules: [
    {
      path: 'first.js',
      declarations: [
        { name: 'FirstElement', tagName: 'first-element', description: 'First element.' },
        { name: 'ExportedElement', description: 'Exported element.' },
      ],
      exports: [
        {
          kind: 'custom-element-definition',
          name: 'exported-element',
          declaration: { name: 'ExportedElement' },
        },
      ],
    },
  ],
};

const loaded = (path: string, manifest: unknown): ManifestLoadResult =>
  ({ path, manifest }) as ManifestLoadResult;

describe('loadManifest', () => {
  it.each([
    [
      'accepts Custom Elements Manifests',
      '/manifest.json',
      JSON.stringify(cem),
      loaded('/manifest.json', cem),
    ],
    [
      'rejects the web-component-analyzer shape',
      '/wca.json',
      JSON.stringify({ version: 'experimental', tags: [] }),
      {
        path: '/wca.json',
        error: {
          name: 'manifest-unsupported',
          message:
            '/wca.json uses the web-component-analyzer manifest shape. The Storybook docgen server reads Custom Elements Manifests only; generate one with @custom-elements-manifest/analyzer.',
        },
      },
    ],
    [
      'rejects objects without modules',
      '/invalid.json',
      JSON.stringify({ tags: 'nope' }),
      {
        path: '/invalid.json',
        error: {
          name: 'manifest-invalid',
          message:
            'Invalid Custom Elements Manifest at /invalid.json: expected a top-level modules array.',
        },
      },
    ],
  ])('%s', async (_name, path, source, expected) => {
    vol.fromNestedJSON({ [path]: source });

    expect(await loadManifest(path)).toEqual(expected);
  });

  it('rejects unparsable JSON', async () => {
    vol.fromNestedJSON({ '/garbage.json': '{nope' });

    expect(await loadManifest('/garbage.json')).toMatchObject({
      path: '/garbage.json',
      error: {
        name: 'manifest-invalid',
        message: expect.stringContaining('Invalid Custom Elements Manifest at /garbage.json:'),
      },
    });
  });
});
