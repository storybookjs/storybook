import { afterEach, describe, expect, it } from 'vitest';

import { clearRegistry } from '../../../../core/src/shared/open-service/server.ts';

import { registerMdxSourceService } from './server.ts';

afterEach(() => {
  clearRegistry();
});

describe('mdx source open service', () => {
  it('loads one import path through the registered reader', async () => {
    const reads: string[] = [];
    const service = registerMdxSourceService({
      read: async (importPath) => {
        reads.push(importPath);
        return `# ${importPath}`;
      },
    });

    await expect(
      service.queries.mdxSource.loaded({ importPath: 'src/Button.mdx' })
    ).resolves.toEqual({ source: '# src/Button.mdx' });
    expect(reads).toEqual(['src/Button.mdx']);
  });

  it('does not read until a query load is requested', async () => {
    const reads: string[] = [];
    registerMdxSourceService({
      read: async (importPath) => {
        reads.push(importPath);
        return importPath;
      },
    });

    expect(reads).toEqual([]);
  });

  it('surfaces reader failures from loaded()', async () => {
    const service = registerMdxSourceService({
      read: async () => {
        throw new Error('missing file');
      },
    });

    await expect(
      service.queries.mdxSource.loaded({ importPath: 'src/Missing.mdx' })
    ).rejects.toThrow('missing file');
  });
});
