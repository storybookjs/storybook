import { describe, expect, it } from 'vitest';

import { createPackageMatcher, getExternal } from './entry-utils.ts';

describe('createPackageMatcher', () => {
  const isExternal = createPackageMatcher(['react', '@babel/types', 'node:fs'], '/');

  it('matches a listed package and its subpaths', () => {
    expect(isExternal('react')).toBe(true);
    expect(isExternal('react/jsx-runtime')).toBe(true);
    expect(isExternal('@babel/types')).toBe(true);
    expect(isExternal('@babel/types/lib/index.js')).toBe(true);
    expect(isExternal('node:fs')).toBe(true);
    expect(isExternal('node:fs/promises')).toBe(true);
  });

  it('does not match packages that only share a name prefix', () => {
    expect(isExternal('react-dom')).toBe(false);
    expect(isExternal('reactive/react')).toBe(false);
    expect(isExternal('@babel/typescript')).toBe(false);
    expect(isExternal('@babel')).toBe(false);
    expect(isExternal('node:fsevents')).toBe(false);
  });

  it('matches files inside node_modules/<package>/', () => {
    expect(isExternal('/repo/node_modules/react/index.d.ts')).toBe(true);
    expect(isExternal('/repo/node_modules/@babel/types/lib/index.d.ts')).toBe(true);
    expect(isExternal('/repo/node_modules/foo/node_modules/react/index.d.ts')).toBe(true);
    expect(isExternal('/repo/node_modules/react-dom/index.d.ts')).toBe(false);
    expect(isExternal('/repo/node_modules/react')).toBe(false);
    expect(isExternal('/repo/src/react/index.d.ts')).toBe(false);
    expect(isExternal('./react/index.d.ts')).toBe(false);
  });

  it('uses the given separator around node_modules segments', () => {
    const isExternalOnWindows = createPackageMatcher(['react'], '\\');

    expect(isExternalOnWindows('C:\\repo\\node_modules\\react\\index.d.ts')).toBe(true);
    expect(isExternalOnWindows('C:\\repo\\node_modules\\react-dom\\index.d.ts')).toBe(false);
    expect(isExternalOnWindows('react/jsx-runtime')).toBe(true);
    expect(isExternalOnWindows('/repo/node_modules/react/index.d.ts')).toBe(false);
  });

  it('matches the real types externals of the core package', async () => {
    const { typesExternal } = await getExternal(`${import.meta.dirname}/../../../code/core`);
    const isCoreTypesExternal = createPackageMatcher(typesExternal, '/');

    expect(isCoreTypesExternal('storybook/internal/types')).toBe(true);
    expect(isCoreTypesExternal('typescript')).toBe(true);
    expect(isCoreTypesExternal('node:path')).toBe(true);
    expect(isCoreTypesExternal('path')).toBe(true);
    expect(isCoreTypesExternal('/repo/node_modules/react-syntax-highlighter/dist/index.d.ts')).toBe(
      true
    );
    expect(isCoreTypesExternal('@babel/types')).toBe(false);
  });
});
