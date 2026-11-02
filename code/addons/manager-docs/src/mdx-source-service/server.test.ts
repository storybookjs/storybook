import { afterEach, describe, expect, it, vi } from 'vitest';

import type { StoryIndex } from 'storybook/internal/types';

import {
  buildStaticFiles,
  clearRegistry,
} from '../../../../core/src/shared/open-service/server.ts';

import { applyMdxSourceChange, registerMdxSourceService } from './server.ts';

const emptyIndex: StoryIndex = { v: 5, entries: {} };

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
      getIndex: async () => emptyIndex,
    });

    await expect(
      service.queries.mdxSource.loaded({ importPath: 'src/Button.mdx' })
    ).resolves.toEqual({ source: '# src/Button.mdx', revision: 0 });
    expect(reads).toEqual(['src/Button.mdx']);
  });

  it('does not read until a query load is requested', async () => {
    const reads: string[] = [];
    registerMdxSourceService({
      read: async (importPath) => {
        reads.push(importPath);
        return importPath;
      },
      getIndex: async () => emptyIndex,
    });

    expect(reads).toEqual([]);
  });

  it('surfaces reader failures from loaded()', async () => {
    const service = registerMdxSourceService({
      read: async () => {
        throw new Error('missing file');
      },
      getIndex: async () => emptyIndex,
    });

    await expect(
      service.queries.mdxSource.loaded({ importPath: 'src/Missing.mdx' })
    ).rejects.toThrow('missing file');
  });

  it('does not let a later read clobber a watched revision', async () => {
    const service = registerMdxSourceService({
      read: async () => '# from disk',
      getIndex: async () => emptyIndex,
    });

    await applyMdxSourceChange({
      importPath: 'src/Button.mdx',
      revision: 3,
      source: '# watched',
    });
    await expect(
      service.queries.mdxSource.loaded({ importPath: 'src/Button.mdx' })
    ).resolves.toEqual({ source: '# watched', revision: 3 });
  });

  it('notifies subscribers when a watched source revision arrives', async () => {
    const service = registerMdxSourceService({
      read: async () => '# initial',
      getIndex: async () => emptyIndex,
    });
    const seen: Array<{ source: string; revision: number } | undefined> = [];
    const unsubscribe = service.queries.mdxSource.subscribe(
      { importPath: 'src/Button.mdx' },
      ({ data }) => {
        seen.push(data);
      }
    );

    await vi.waitFor(() => {
      expect(seen.at(-1)).toEqual({ source: '# initial', revision: 0 });
    });

    await applyMdxSourceChange({
      importPath: 'src/Button.mdx',
      revision: 1,
      source: '# edited',
    });

    await vi.waitFor(() => {
      expect(seen.at(-1)).toEqual({ source: '# edited', revision: 1 });
    });
    unsubscribe();
  });

  it('keeps the last good source when a watched parse error arrives', async () => {
    const service = registerMdxSourceService({
      read: async () => '# initial',
      getIndex: async () => emptyIndex,
    });
    await service.queries.mdxSource.loaded({ importPath: 'src/Button.mdx' });

    const error = {
      file: 'src/Button.mdx',
      line: 3,
      column: 1,
      construct: 'jsx',
      message: 'Unclosed tag.',
    };
    await applyMdxSourceChange({
      importPath: 'src/Button.mdx',
      revision: 1,
      error,
    });

    expect(service.queries.mdxSource.get({ importPath: 'src/Button.mdx' })).toEqual({
      source: '# initial',
      revision: 1,
      error,
    });
  });

  it('builds one static JSON file per MDX import path from the story index', async () => {
    const reads: string[] = [];
    registerMdxSourceService({
      read: async (importPath) => {
        reads.push(importPath);
        return `# ${importPath}`;
      },
      getIndex: async () =>
        ({
          v: 5,
          entries: {
            'button--docs': {
              id: 'button--docs',
              type: 'docs',
              importPath: 'src/Button.mdx',
            },
            'guide--docs': {
              id: 'guide--docs',
              type: 'docs',
              importPath: './src/Guide.mdx',
            },
            'button--primary': {
              id: 'button--primary',
              type: 'story',
              importPath: 'src/Button.stories.ts',
            },
          },
        }) as StoryIndex,
    });

    const store = await buildStaticFiles();

    expect(Object.keys(store).sort()).toEqual([
      'experimental-manager-docs/mdx-source/src/Button.mdx.json',
      'experimental-manager-docs/mdx-source/src/Guide.mdx.json',
    ]);
    expect(store['experimental-manager-docs/mdx-source/src/Button.mdx.json']).toEqual({
      sources: {
        'src/Button.mdx': { source: '# src/Button.mdx', revision: 0 },
      },
    });
    expect(store['experimental-manager-docs/mdx-source/src/Guide.mdx.json']).toEqual({
      sources: {
        './src/Guide.mdx': { source: '# ./src/Guide.mdx', revision: 0 },
      },
    });
    expect(reads.sort()).toEqual(['./src/Guide.mdx', 'src/Button.mdx']);
  });
});
