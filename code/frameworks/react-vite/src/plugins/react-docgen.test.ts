import { join, normalize } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as TsconfigPaths from 'tsconfig-paths';

import { RESOLVE_EXTENSIONS } from './docgen-resolver.ts';

import { getReactDocgenImporter } from './react-docgen.ts';

const reactDocgenMock = vi.hoisted(() => {
  return {
    makeFsImporter: vi.fn().mockImplementation((fn) => fn),
  };
});

const reactDocgenResolverMock = vi.hoisted(() => {
  return {
    defaultLookupModule: vi.fn(),
  };
});

vi.mock('./docgen-resolver', async (importOriginal) => {
  const actual = await importOriginal<typeof import('path')>();
  return {
    ...actual,
    defaultLookupModule: reactDocgenResolverMock.defaultLookupModule,
  };
});

vi.mock('react-docgen', async (importOriginal) => {
  const actual = await importOriginal<typeof import('path')>();
  return {
    ...actual,
    makeFsImporter: reactDocgenMock.makeFsImporter,
  };
});

describe('getReactDocgenImporter function', () => {
  beforeEach(() => {
    reactDocgenResolverMock.defaultLookupModule.mockImplementation((filen: string) => filen);
  });

  it('should not map the request if a tsconfig path mapping is not available', () => {
    const filename = './src/components/Button.tsx';
    const basedir = '/src';
    const imported = getReactDocgenImporter(undefined);
    reactDocgenResolverMock.defaultLookupModule.mockImplementation((filen: string) => filen);
    const result = (imported as any)(filename, basedir);
    expect(result).toBe(filename);
  });

  it('should map the request', () => {
    const mappedFile = './mapped-file.tsx';
    const matchPath = vi.fn().mockReturnValue(mappedFile);
    const filename = './src/components/Button.tsx';
    const basedir = '/src';
    const imported = getReactDocgenImporter(matchPath);
    reactDocgenResolverMock.defaultLookupModule.mockImplementation((filen: string) => filen);
    const result = (imported as any)(filename, basedir);
    expect(result).toBe(mappedFile);
  });

  it('lets tsconfig paths match TypeScript files', () => {
    // Without extensions, tsconfig-paths only tries `.js`, `.json` and `.node`, so an alias to a
    // `.ts` file such as `@/components/types` would never match.
    const matchPath = vi.fn().mockReturnValue('/project/src/components/types.ts');
    const imported = getReactDocgenImporter(matchPath);

    (imported as any)('@/components/types', '/project/src/components');

    expect(matchPath).toHaveBeenCalledWith(
      '@/components/types',
      undefined,
      undefined,
      expect.arrayContaining(['.ts', '.tsx'])
    );
  });

  it('resolves an alias to a TypeScript file with the extensions it passes', () => {
    const root = join(import.meta.dirname, '__testfixtures__/alias');
    const matchPath = TsconfigPaths.createMatchPath(root, { '@/*': ['./src/*'] });

    // tsconfig-paths preserves the POSIX separators of the tsconfig mapping in the mapped suffix,
    // which does not match `join`'s platform separators on Windows, so normalize both sides first.
    const resolved = matchPath('@/components/types', undefined, undefined, RESOLVE_EXTENSIONS);

    expect(resolved).toBeDefined();
    expect(normalize(resolved ?? '')).toBe(join(root, 'src', 'components', 'types'));
    expect(matchPath('@/components/types')).toBeUndefined();
  });
});
