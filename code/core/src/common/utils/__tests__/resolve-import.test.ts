import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
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

function writeFixture(directory: string, relativePath: string, contents = 'export {};') {
  const filePath = join(directory, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
  return realpathSync(filePath);
}

function writePackage(directory: string, name: string, exportsField: Record<string, string>) {
  writeFixture(
    directory,
    `node_modules/${name}/package.json`,
    JSON.stringify({ name, exports: { '.': exportsField } })
  );
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

  it('resolves a package whose exports map declares no default condition', () => {
    const directory = createTemporaryDirectory();
    writePackage(directory, 'dual-package', {
      types: './dist/index.d.ts',
      import: './dist/index.mjs',
      require: './dist/index.cjs',
    });
    const expected = writeFixture(directory, 'node_modules/dual-package/dist/index.mjs');
    writeFixture(directory, 'node_modules/dual-package/dist/index.cjs');

    expect(resolveImport('dual-package', { basedir: directory })).toBe(expected);
  });

  it('prefers the sources a package points at over its bundled output', () => {
    const directory = createTemporaryDirectory();
    writePackage(directory, 'source-package', {
      source: './src/index.ts',
      import: './dist/index.mjs',
    });
    const expected = writeFixture(directory, 'node_modules/source-package/src/index.ts');
    writeFixture(directory, 'node_modules/source-package/dist/index.mjs');

    expect(resolveImport('source-package', { basedir: directory })).toBe(expected);
  });

  it('falls back to the bundled output when a declared source is not shipped', () => {
    const directory = createTemporaryDirectory();
    writePackage(directory, 'unshipped-source-package', {
      source: './src/index.ts',
      default: './dist/index.js',
    });
    const expected = writeFixture(directory, 'node_modules/unshipped-source-package/dist/index.js');

    expect(resolveImport('unshipped-source-package', { basedir: directory })).toBe(expected);
  });
});
