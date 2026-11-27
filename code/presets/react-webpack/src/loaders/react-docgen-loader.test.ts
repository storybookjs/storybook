import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getReactDocgenImporter } from './react-docgen-loader.ts';

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
});
