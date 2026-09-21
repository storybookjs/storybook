import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fs as memfs, vol } from 'memfs';

import {
  MissingCustomElementsManifestError,
  resolveManifestPaths,
} from './resolve-manifest-paths.ts';

vi.mock('node:fs', { spy: true });

beforeEach(() => {
  vol.reset();
  vi.mocked(existsSync).mockImplementation(memfs.existsSync);
  vi.mocked(readFileSync).mockImplementation(memfs.readFileSync as typeof readFileSync);
});

describe('resolveManifestPaths', () => {
  it.each([
    ['a framework option string', 'custom-elements.json', ['/workspace/custom-elements.json']],
    [
      'a framework option array',
      ['one.json', 'two.json'],
      ['/workspace/one.json', '/workspace/two.json'],
    ],
  ])('resolves %s', (_name, customElementsManifest, expectedManifestPaths) => {
    vol.fromNestedJSON({
      '/workspace/custom-elements.json': '{}',
      '/workspace/one.json': '{}',
      '/workspace/two.json': '{}',
    });

    expect(resolveManifestPaths('/workspace', { customElementsManifest })).toEqual(
      expectedManifestPaths
    );
  });

  it('resolves package.json#customElements relative to the package file', () => {
    vol.fromNestedJSON({
      '/workspace/package.json': JSON.stringify({ customElements: 'dist/custom-elements.json' }),
    });

    expect(resolveManifestPaths('/workspace', {})).toEqual([
      '/workspace/dist/custom-elements.json',
    ]);
  });

  it('throws when an explicit framework option path does not exist', () => {
    const path = resolve('/workspace/missing.json');

    expect(() =>
      resolveManifestPaths('/workspace', { customElementsManifest: 'missing.json' })
    ).toThrowError(MissingCustomElementsManifestError);
    expect(() =>
      resolveManifestPaths('/workspace', { customElementsManifest: 'missing.json' })
    ).toThrow(
      `The customElementsManifest framework option points to a file that does not exist: ${path}`
    );
  });
});
