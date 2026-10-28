import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fs as memfs, vol } from 'memfs';

import { findFilesUp } from '@storybook/core/internal/common';

import { createDocgenDescriptor, withComponentsManifest } from './provider.ts';

vi.mock('node:fs', { spy: true });
vi.mock('@storybook/core/internal/common', { spy: true });

const CONFIG_DIR = resolve('/workspace/.storybook');

beforeEach(() => {
  vi.clearAllMocks();
  vol.reset();
  vi.mocked(findFilesUp).mockReturnValue([]);
  vi.mocked(existsSync).mockImplementation(memfs.existsSync as typeof existsSync);
  vi.mocked(readFileSync).mockImplementation(memfs.readFileSync as typeof readFileSync);
});

describe('createDocgenDescriptor', () => {
  it.each<{
    name: string;
    files: Record<string, string>;
    packageJsons?: string[];
    frameworkOptions: Record<string, unknown> | undefined;
    expected: Record<string, unknown>;
  }>([
    {
      name: 'reads the manifest from package.json customElements',
      files: {
        '/workspace/package.json': JSON.stringify({ customElements: 'dist/custom-elements.json' }),
      },
      packageJsons: ['/workspace/package.json'],
      frameworkOptions: undefined,
      expected: { manifestPaths: [resolve('/workspace/dist/custom-elements.json')] },
    },
    {
      name: 'passes an explicit manifest path to the worker',
      files: { '/workspace/.storybook/custom-elements.json': JSON.stringify({ modules: [] }) },
      frameworkOptions: { customElementsManifest: 'custom-elements.json' },
      expected: { manifestPaths: [resolve('/workspace/.storybook/custom-elements.json')] },
    },
    {
      name: 'passes the preview file to the worker',
      files: { '/workspace/.storybook/preview.ts': '' },
      frameworkOptions: {},
      expected: {
        manifestPaths: [],
        previewFilePath: resolve('/workspace/.storybook/preview.ts'),
      },
    },
  ])('$name', ({ files, packageJsons, frameworkOptions, expected }) => {
    vol.fromNestedJSON(files);
    if (packageJsons) {
      vi.mocked(findFilesUp).mockReturnValue(packageJsons);
    }

    expect(createDocgenDescriptor(CONFIG_DIR, frameworkOptions)).toEqual({
      moduleSpecifier: expect.stringMatching(/docgen-worker\.js$/),
      options: expected,
    });
  });
});

describe('withComponentsManifest', () => {
  it.each([
    { name: 'docgen server flag off', features: { componentsManifest: true }, expected: {} },
    { name: 'components manifest flag off', features: { docgenServer: true }, expected: {} },
    {
      name: 'both flags on',
      features: { docgenServer: true, componentsManifest: true },
      expected: {
        components: {
          v: 0,
          components: {},
          meta: { docgen: 'custom-elements-manifest', durationMs: 0 },
        },
      },
    },
  ])('$name', ({ features, expected }) => {
    expect(withComponentsManifest({}, features)).toEqual(expected);
  });
});
