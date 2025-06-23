import { describe, expect, it, vi } from 'vitest';

import { getReactDocgenImporter } from './react-docgen';

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
});
