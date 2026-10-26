import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { resolveImport } from './interpret-files.ts';

// oxc-resolver is a native binding that reads the real filesystem, so memfs cannot intercept it.
const fixtureRoot = realpathSync(mkdtempSync(join(tmpdir(), 'sb-module-resolver-')));

afterAll(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});

const writePackage = (name: string, packageJson: object, files: Record<string, string>) => {
  const packageDir = join(fixtureRoot, 'node_modules', name);
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(join(packageDir, 'package.json'), JSON.stringify(packageJson));
  for (const [file, content] of Object.entries(files)) {
    writeFileSync(join(packageDir, file), content);
  }
};

describe('resolveImport', () => {
  it('resolves a package whose exports map has only conditional entries', () => {
    writePackage(
      'conditional-exports-only',
      {
        name: 'conditional-exports-only',
        main: './main.cjs',
        exports: { '.': { import: './entry.mjs', require: './entry.cjs' } },
      },
      { 'entry.mjs': 'export {};', 'entry.cjs': 'module.exports = {};', 'main.cjs': '' }
    );

    expect(resolveImport('conditional-exports-only', { basedir: fixtureRoot })).toBe(
      join(fixtureRoot, 'node_modules', 'conditional-exports-only', 'entry.mjs')
    );
  });

  it('resolves a package without an exports map through its main fields', () => {
    writePackage(
      'main-only',
      { name: 'main-only', module: './entry.mjs', main: './main.cjs' },
      { 'entry.mjs': 'export {};', 'main.cjs': '' }
    );

    expect(resolveImport('main-only', { basedir: fixtureRoot })).toBe(
      join(fixtureRoot, 'node_modules', 'main-only', 'entry.mjs')
    );
  });
});
