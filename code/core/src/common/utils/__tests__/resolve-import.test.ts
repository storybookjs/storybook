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

  it('falls back from .js imports to .tsx files', () => {
    const directory = createTemporaryDirectory();
    const expected = writeFixture(directory, 'Component.tsx');

    expect(resolveImport('./Component.js', { basedir: directory })).toBe(expected);
  });

  it('prefers .ts files before the .tsx fallback for .js imports', () => {
    const directory = createTemporaryDirectory();
    const expected = writeFixture(directory, 'Component.ts');
    writeFixture(directory, 'Component.tsx');

    expect(resolveImport('./Component.js', { basedir: directory })).toBe(expected);
  });

  it('continues to fall back from .jsx imports to .tsx files', () => {
    const directory = createTemporaryDirectory();
    const expected = writeFixture(directory, 'Component.tsx');

    expect(resolveImport('./Component.jsx', { basedir: directory })).toBe(expected);
  });
});
