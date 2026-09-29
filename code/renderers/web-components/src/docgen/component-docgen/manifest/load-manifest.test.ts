import { readFile } from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fs as memfs, vol } from 'memfs';

import type { ManifestLoadResult } from './load-manifest.ts';
import { isFailedManifest, loadManifest } from './load-manifest.ts';

vi.mock('node:fs/promises', { spy: true });

beforeEach(() => {
  vol.reset();
  vi.spyOn(process, 'cwd').mockReturnValue('/workspace');
  vi.mocked(readFile).mockImplementation(memfs.promises.readFile as typeof readFile);
});

afterEach(() => {
  vi.restoreAllMocks();
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
      '/workspace/manifest.json',
      JSON.stringify(cem),
      loaded('manifest.json', cem),
    ],
    [
      'rejects the web-component-analyzer shape',
      '/workspace/wca.json',
      JSON.stringify({ version: 'experimental', tags: [] }),
      {
        path: 'wca.json',
        error: {
          name: 'manifest-unsupported',
          message:
            'wca.json uses the web-component-analyzer manifest shape. The Storybook docgen server reads Custom Elements Manifests only; generate one with @custom-elements-manifest/analyzer.',
        },
      },
    ],
    [
      'rejects objects without modules',
      '/workspace/invalid.json',
      JSON.stringify({ tags: 'nope' }),
      {
        path: 'invalid.json',
        error: {
          name: 'manifest-invalid',
          message:
            'Invalid Custom Elements Manifest at invalid.json: expected a top-level modules array.',
        },
      },
    ],
  ])('%s', async (_name, path, source, expected) => {
    vol.fromNestedJSON({ [path]: source });

    expect(await loadManifest(path)).toEqual(expected);
  });

  it('rejects unparsable JSON', async () => {
    vol.fromNestedJSON({ '/workspace/garbage.json': '{nope' });

    expect(await loadManifest('/workspace/garbage.json')).toMatchObject({
      path: 'garbage.json',
      error: {
        name: 'manifest-invalid',
        message: expect.stringContaining('Invalid Custom Elements Manifest at garbage.json:'),
      },
    });
  });

  it.each([
    [
      'failed',
      { path: 'invalid.json', error: { name: 'manifest-invalid', message: 'nope' } },
      true,
    ],
    ['loaded', loaded('manifest.json', cem), false],
  ] as const)('identifies %s manifest results', (_name, result, expected) => {
    expect(isFailedManifest(result)).toBe(expected);
  });
});
