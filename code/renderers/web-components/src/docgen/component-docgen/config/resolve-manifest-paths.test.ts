import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fs as memfs, vol } from 'memfs';

import { findFilesUp } from 'storybook/internal/common';

import {
  MissingCustomElementsManifestError,
  resolveManifestPaths,
} from './resolve-manifest-paths.ts';

vi.mock('node:fs', { spy: true });
vi.mock('storybook/internal/common', { spy: true });

beforeEach(() => {
  vi.clearAllMocks();
  vol.reset();
  vi.mocked(existsSync).mockImplementation(memfs.existsSync);
  vi.mocked(findFilesUp).mockReturnValue([]);
  vi.mocked(readFileSync).mockImplementation(memfs.readFileSync as typeof readFileSync);
});

describe('resolveManifestPaths', () => {
  it.each([
    ['a framework option string', '../custom-elements.json', ['/workspace/custom-elements.json']],
    [
      'a framework option array',
      ['../one.json', '../two.json'],
      ['/workspace/one.json', '/workspace/two.json'],
    ],
  ])('resolves %s', (_name, customElementsManifest, expectedManifestPaths) => {
    vol.fromNestedJSON({
      '/workspace/custom-elements.json': '{}',
      '/workspace/one.json': '{}',
      '/workspace/two.json': '{}',
    });

    expect(resolveManifestPaths('/workspace/.storybook', { customElementsManifest })).toEqual(
      expectedManifestPaths.map((path) => resolve(path))
    );
  });

  it('resolves package.json#customElements relative to the package file', () => {
    vol.fromNestedJSON({
      '/workspace/package.json': JSON.stringify({ customElements: 'dist/custom-elements.json' }),
    });
    vi.mocked(findFilesUp).mockReturnValue(['/workspace/package.json']);

    expect(resolveManifestPaths('/workspace/.storybook', {})).toEqual([
      resolve('/workspace/dist/custom-elements.json'),
    ]);
  });

  it('ignores package.json#customElements when the framework option is set', () => {
    vol.fromNestedJSON({
      '/workspace/package.json': JSON.stringify({ customElements: 'dist/custom-elements.json' }),
      '/workspace/custom-elements.json': '{}',
    });
    vi.mocked(findFilesUp).mockReturnValue(['/workspace/package.json']);

    expect(
      resolveManifestPaths('/workspace/.storybook', {
        customElementsManifest: '../custom-elements.json',
      })
    ).toEqual([resolve('/workspace/custom-elements.json')]);
    expect(findFilesUp).not.toHaveBeenCalled();
  });

  it('finds package.json from a nested config directory', () => {
    vol.fromNestedJSON({
      '/workspace/apps/foo/package.json': JSON.stringify({
        customElements: 'dist/custom-elements.json',
      }),
    });
    vi.mocked(findFilesUp).mockReturnValue(['/workspace/apps/foo/package.json']);

    expect(resolveManifestPaths('/workspace/apps/foo/config/storybook', {})).toEqual([
      resolve('/workspace/apps/foo/dist/custom-elements.json'),
    ]);
    expect(findFilesUp).toHaveBeenCalledWith(
      ['package.json'],
      '/workspace/apps/foo/config/storybook'
    );
  });

  it('returns an empty array without options or package.json', () => {
    expect(resolveManifestPaths('/workspace/.storybook', {})).toEqual([]);
  });

  it('throws when an explicit framework option path does not exist', () => {
    const path = resolve('/workspace/.storybook/missing.json');

    expect(() =>
      resolveManifestPaths('/workspace/.storybook', { customElementsManifest: 'missing.json' })
    ).toThrowError(MissingCustomElementsManifestError);
    expect(() =>
      resolveManifestPaths('/workspace/.storybook', { customElementsManifest: 'missing.json' })
    ).toThrow(
      `The customElementsManifest framework option points to a file that does not exist: ${path}`
    );
  });
});
