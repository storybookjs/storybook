import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, test } from 'vitest';

import path from 'pathe';

import { findExportSubpathImport } from './packageExports.ts';
import { invalidateCache } from './utils.ts';

const roots: string[] = [];

afterEach(() => {
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
  invalidateCache();
});

// A package on disk, so the real module resolver checks every subpath.
function fixture(exportsMap: Record<string, unknown>, files: string[]) {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'package-exports-')));
  roots.push(root);
  writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ name: '@acme/ui', exports: exportsMap })
  );
  for (const file of files) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), 'export const Button = () => null;\n');
  }
  return (file: string) =>
    findExportSubpathImport('@acme/ui', exportsMap, root, path.join(root, file));
}

describe('findExportSubpathImport', () => {
  test('finds the key whose target is the file', () => {
    const importOf = fixture({ './button': './src/button.tsx' }, ['src/button.tsx']);

    expect(importOf('src/button.tsx')).toBe('@acme/ui/button');
  });

  test('expands a pattern key', () => {
    const importOf = fixture({ './components/*': './src/*.tsx' }, ['src/button.tsx']);

    expect(importOf('src/button.tsx')).toBe('@acme/ui/components/button');
  });

  test('expands a pattern whose target repeats `*`', () => {
    const importOf = fixture({ './*': './src/*/*.tsx' }, ['src/button/button.tsx', 'src/a/b.tsx']);

    expect(importOf('src/button/button.tsx')).toBe('@acme/ui/button');
    expect(importOf('src/a/b.tsx')).toBe(undefined);
  });

  test('prefers an exact key over a pattern key that reaches the same file', () => {
    const importOf = fixture({ './components/*': './src/*.tsx', './button': './src/button.tsx' }, [
      'src/button.tsx',
    ]);

    expect(importOf('src/button.tsx')).toBe('@acme/ui/button');
  });

  test('reads targets inside condition objects', () => {
    const importOf = fixture(
      { './button': { types: './dist/button.d.ts', import: './src/button.tsx' } },
      ['src/button.tsx']
    );

    expect(importOf('src/button.tsx')).toBe('@acme/ui/button');
  });

  test('skips a target that only `require` reaches', () => {
    const importOf = fixture({ './button': { require: './src/button.tsx' } }, ['src/button.tsx']);

    expect(importOf('src/button.tsx')).toBe(undefined);
  });

  test('skips a subpath that an exact key excludes', () => {
    const importOf = fixture({ './*': './src/*.tsx', './button': null }, ['src/button.tsx']);

    expect(importOf('src/button.tsx')).toBe(undefined);
  });

  test('skips a target without a leading `./`', () => {
    const importOf = fixture({ './button': 'src/button.tsx' }, ['src/button.tsx']);

    expect(importOf('src/button.tsx')).toBe(undefined);
  });

  test('skips an exports map that mixes subpaths and conditions', () => {
    const importOf = fixture({ './button': './src/button.tsx', import: './src/index.ts' }, [
      'src/button.tsx',
      'src/index.ts',
    ]);

    expect(importOf('src/button.tsx')).toBe(undefined);
  });

  test('skips a target inside `node_modules`', () => {
    const importOf = fixture({ './*': './*' }, ['node_modules/x/button.tsx']);

    expect(importOf('node_modules/x/button.tsx')).toBe(undefined);
  });

  test('follows an array of fallback targets', () => {
    const importOf = fixture({ './button': ['bad', './src/button.tsx'] }, ['src/button.tsx']);

    expect(importOf('src/button.tsx')).toBe('@acme/ui/button');
  });

  test('returns undefined when no subpath reaches the file', () => {
    const importOf = fixture({ './card': './src/card.tsx' }, ['src/card.tsx', 'src/button.tsx']);

    expect(importOf('src/button.tsx')).toBe(undefined);
  });
});
