import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { createStoryReferenceResolver } from './reference-context.ts';

// oxc-resolver reads the real filesystem, so these cases resolve against fixture files.
const FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  '__testfixtures__',
  'extension-alias'
);

const resolvedPath = (specifier: string) =>
  createStoryReferenceResolver()().resolveModule?.(join(FIXTURES, 'x.stories.ts'), specifier)
    ?.filePath;

describe('createStoryReferenceResolver', () => {
  it.each([
    { specifier: './card.jsx', file: 'card.tsx' },
    { specifier: './esm.mjs', file: 'esm.mts' },
    { specifier: './common.cjs', file: 'common.cts' },
  ])('resolves $specifier to the TypeScript source $file', ({ specifier, file }) => {
    expect(resolvedPath(specifier)).toBe(join(FIXTURES, file));
  });

  it('resolves a JavaScript specifier with no TypeScript source to the JavaScript file', () => {
    expect(resolvedPath('./plain.js')).toBe(join(FIXTURES, 'plain.js'));
  });

  it('resolves a JavaScript specifier to the JavaScript file where both exist, as Vite does', () => {
    expect(resolvedPath('./button.js')).toBe(join(FIXTURES, 'button.js'));
  });

  describe('in node_modules', () => {
    // A fixture directory named node_modules is ignored by git, so the package is written here.
    const root = mkdtempSync(join(tmpdir(), 'story-references-'));
    const pkg = join(root, 'node_modules', 'pkg');
    mkdirSync(pkg, { recursive: true });
    mkdirSync(join(root, 'src'));
    writeFileSync(join(pkg, 'package.json'), '{ "name": "pkg", "main": "index.js" }');
    writeFileSync(join(pkg, 'index.ts'), 'export const a = 1;');
    afterAll(() => rmSync(root, { recursive: true, force: true }));

    it('does not resolve a JavaScript specifier to TypeScript source', () => {
      const resolve = createStoryReferenceResolver()().resolveModule!;
      expect(resolve(join(root, 'src', 'x.stories.ts'), 'pkg/index.js')).toBeUndefined();
    });
  });

  it('resolves a specifier without an extension as before', () => {
    expect(resolvedPath('./button')).toBe(join(FIXTURES, 'button.ts'));
  });

  it('reads the module it resolves to', () => {
    const resolved = createStoryReferenceResolver()().resolveModule?.(
      join(FIXTURES, 'x.stories.ts'),
      './esm.mjs'
    );
    expect(resolved?.program.node.body).toHaveLength(1);
  });
});
