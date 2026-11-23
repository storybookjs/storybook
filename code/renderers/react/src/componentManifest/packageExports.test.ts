import { describe, expect, test } from 'vitest';

import { findExportSubpath, resolveExportSubpath } from './packageExports.ts';

const root = '/app/packages/ui';
const button = `${root}/src/button.tsx`;

describe('resolveExportSubpath', () => {
  test('prefers an exact key over a pattern key', () => {
    const exportsMap = { './*': './src/*.tsx', './button': './src/other.tsx' };

    expect(resolveExportSubpath(exportsMap, './button')).toBe('./src/other.tsx');
  });

  test('prefers the pattern key with the longest prefix', () => {
    const exportsMap = { './*': './src/*.tsx', './icons/*': './icons/*.tsx' };

    expect(resolveExportSubpath(exportsMap, './icons/star')).toBe('./icons/star.tsx');
  });

  test('replaces every `*` of a target', () => {
    expect(resolveExportSubpath({ './*': './src/*/*.tsx' }, './button')).toBe(
      './src/button/button.tsx'
    );
  });

  test('returns null for an excluded subpath', () => {
    const exportsMap = { './*': './src/*.tsx', './internal': null };

    expect(resolveExportSubpath(exportsMap, './internal')).toBeNull();
  });

  test('skips conditions outside the import conditions', () => {
    const exportsMap = {
      './button': { require: './cjs/button.js', import: './src/button.tsx' },
    };

    expect(resolveExportSubpath(exportsMap, './button')).toBe('./src/button.tsx');
    expect(resolveExportSubpath({ './button': { require: './cjs/button.js' } }, './button')).toBe(
      undefined
    );
  });
});

describe('findExportSubpath', () => {
  test('finds the key whose target is the file', () => {
    expect(findExportSubpath({ './button': './src/button.tsx' }, root, button)).toBe('./button');
  });

  test('expands a pattern key', () => {
    expect(findExportSubpath({ './components/*': './src/*.tsx' }, root, button)).toBe(
      './components/button'
    );
  });

  test('expands a pattern whose target repeats `*`', () => {
    expect(
      findExportSubpath({ './*': './src/*/*.tsx' }, root, `${root}/src/button/button.tsx`)
    ).toBe('./button');
  });

  test('reads targets inside condition objects', () => {
    const exportsMap = {
      './button': { types: './dist/button.d.ts', import: './src/button.tsx' },
    };

    expect(findExportSubpath(exportsMap, root, button)).toBe('./button');
  });

  test('skips a subpath that an exact key excludes', () => {
    expect(findExportSubpath({ './*': './src/*.tsx', './button': null }, root, button)).toBe(
      undefined
    );
  });

  test('skips a target that only `require` reaches', () => {
    expect(findExportSubpath({ './button': { require: './src/button.tsx' } }, root, button)).toBe(
      undefined
    );
  });

  test('returns undefined when no subpath reaches the file', () => {
    expect(findExportSubpath({ './card': './src/card.tsx' }, root, button)).toBe(undefined);
  });
});
