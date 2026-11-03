import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import * as TsconfigPaths from 'tsconfig-paths';

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

  it('maps a tsconfig path alias to a TypeScript file', () => {
    const root = mkdtempSync(join(tmpdir(), 'sb-docgen-alias-'));
    mkdirSync(join(root, 'src/components'), { recursive: true });
    writeFileSync(join(root, 'src/components/types.ts'), 'export interface Props {}');
    const matchPath = TsconfigPaths.createMatchPath(root, { '@/*': ['./src/*'] });
    // Like the real lookup, resolve the extensionless path that tsconfig-paths returns.
    reactDocgenResolverMock.defaultLookupModule.mockImplementation((filen: string) =>
      filen.startsWith(root) ? `${filen}.ts` : filen
    );

    const imported = getReactDocgenImporter(matchPath);

    expect((imported as any)('@/components/types', join(root, 'src/components'))).toBe(
      join(root, 'src/components/types.ts')
    );
  });
});
