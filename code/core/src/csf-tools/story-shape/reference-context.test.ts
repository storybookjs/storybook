import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

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
    { specifier: './button.js', file: 'button.ts' },
    { specifier: './card.jsx', file: 'card.tsx' },
    { specifier: './esm.mjs', file: 'esm.mts' },
    { specifier: './common.cjs', file: 'common.cts' },
  ])('resolves $specifier to the TypeScript source $file', ({ specifier, file }) => {
    expect(resolvedPath(specifier)).toBe(join(FIXTURES, file));
  });

  it('resolves a JavaScript specifier with no TypeScript source to the JavaScript file', () => {
    expect(resolvedPath('./plain.js')).toBe(join(FIXTURES, 'plain.js'));
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
