import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { resolveImport } from '../interpret-files.ts';

const temporaryDirectories: string[] = [];

function createTemporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'storybook-resolve-import-'));
  temporaryDirectories.push(directory);
  return directory;
}

function writeFixture(directory: string, relativePath: string) {
  const filePath = join(directory, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, 'export {};');
  return filePath;
}

describe('resolveImport', () => {
  afterEach(() => {
    for (const directory of temporaryDirectories) {
      rmSync(directory, { force: true, recursive: true });
    }
    temporaryDirectories.length = 0;
  });

  it.each([
    ['.js', '.tsx'],
    ['.mjs', '.mtsx'],
    ['.cjs', '.ctsx'],
  ])('falls back from %s imports to %s files', (importExtension, fallbackExtension) => {
    const directory = createTemporaryDirectory();
    const expected = writeFixture(directory, `Component${fallbackExtension}`);

    expect(resolveImport(`./Component${importExtension}`, { basedir: directory })).toBe(expected);
  });

  it.each([
    ['.js', '.ts', '.tsx'],
    ['.mjs', '.mts', '.mtsx'],
    ['.cjs', '.cts', '.ctsx'],
  ])(
    'prefers the non-JSX TypeScript fallback before the JSX fallback',
    (importExtension, preferredExtension, fallbackExtension) => {
      const directory = createTemporaryDirectory();
      const expected = writeFixture(directory, `Component${preferredExtension}`);
      writeFixture(directory, `Component${fallbackExtension}`);

      expect(resolveImport(`./Component${importExtension}`, { basedir: directory })).toBe(expected);
    }
  );

  it('continues to fall back from .jsx imports to .tsx files', () => {
    const directory = createTemporaryDirectory();
    const expected = writeFixture(directory, 'Component.tsx');

    expect(resolveImport('./Component.jsx', { basedir: directory })).toBe(expected);
  });
});
