import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { stripAbsNodeModulesPath } from './strip-abs-node-modules-path.ts';

// Paths go through resolve() so the fixtures carry the separator of the platform the
// tests run on: CI runs these on Windows as well as Linux.
describe('stripAbsNodeModulesPath', () => {
  it('turns an absolute path into a bare import path', () => {
    expect(
      stripAbsNodeModulesPath(
        resolve('/project/node_modules/@storybook/react/dist/entry-preview.mjs')
      )
    ).toBe('@storybook/react/dist/entry-preview.mjs');
  });

  it('keeps the last package when node_modules is nested', () => {
    expect(
      stripAbsNodeModulesPath(resolve('/project/node_modules/a/node_modules/b/dist/index.mjs'))
    ).toBe('b/dist/index.mjs');
  });

  // Yarn's pnpm linker stores packages in node_modules/.store/<name>-virtual-<hash>/package,
  // so stripping up to the last node_modules leaves ".store/…", which is not a specifier any
  // bundler can resolve. The directory name is mangled, so the package name cannot be
  // recovered from the path — leaving it absolute is what keeps it resolvable.
  it('leaves paths under the pnpm linker store untouched', () => {
    const abs = resolve(
      '/project/node_modules/.store/@storybook-react-virtual-d2ec5c3452/package/dist/entry-preview.mjs'
    );

    expect(stripAbsNodeModulesPath(abs)).toBe(abs);
  });

  it('still strips packages whose name merely starts with .store', () => {
    expect(
      stripAbsNodeModulesPath(resolve('/project/node_modules/.storefront/dist/index.mjs'))
    ).toBe('.storefront/dist/index.mjs');
  });
});
