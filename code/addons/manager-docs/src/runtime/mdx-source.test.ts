import { afterEach, describe, expect, it, vi } from 'vitest';

import type { StoryIndex } from 'storybook/internal/types';

import { clearRegistry } from '../../../../core/src/shared/open-service/server.ts';

import { applyMdxSourceChange, registerMdxSourceService } from '../mdx-source-service/server.ts';
import { readMdxSourceFromService, subscribeMdxSource } from './mdx-source.ts';
import type { MdxSourceChange } from './source-transport.ts';

const emptyIndex: StoryIndex = { v: 5, entries: {} };

afterEach(() => {
  clearRegistry();
});

describe('readMdxSourceFromService', () => {
  it('requests MDX source through the open service in development', async () => {
    const reads: string[] = [];
    registerMdxSourceService({
      read: async (importPath) => {
        reads.push(importPath);
        return `# ${importPath}`;
      },
      getIndex: async () => emptyIndex,
    });

    await expect(readMdxSourceFromService('src/Button.mdx')).resolves.toBe('# src/Button.mdx');
    expect(reads).toEqual(['src/Button.mdx']);
  });
});

describe('subscribeMdxSource', () => {
  it('maps a source revision onto the live-reload change shape', async () => {
    registerMdxSourceService({
      read: async () => '# initial',
      getIndex: async () => emptyIndex,
    });
    const seen: MdxSourceChange[] = [];
    const unsubscribe = subscribeMdxSource('src/Button.mdx', (change) => {
      seen.push(change);
    });

    await vi.waitFor(() => {
      expect(seen.at(-1)).toEqual({
        importPath: 'src/Button.mdx',
        revision: 0,
        source: '# initial',
      });
    });

    await applyMdxSourceChange({
      importPath: 'src/Button.mdx',
      revision: 1,
      source: '# edited',
    });

    await vi.waitFor(() => {
      expect(seen.at(-1)).toEqual({
        importPath: 'src/Button.mdx',
        revision: 1,
        source: '# edited',
      });
    });
    unsubscribe();
  });

  it('maps a parse-error revision onto the live-reload change shape', async () => {
    registerMdxSourceService({
      read: async () => '# initial',
      getIndex: async () => emptyIndex,
    });
    const seen: MdxSourceChange[] = [];
    const unsubscribe = subscribeMdxSource('src/Button.mdx', (change) => {
      seen.push(change);
    });

    await vi.waitFor(() => {
      expect(seen.some((change) => change.revision === 0)).toBe(true);
    });

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

    await vi.waitFor(() => {
      expect(seen.at(-1)).toEqual({
        importPath: 'src/Button.mdx',
        revision: 1,
        error,
      });
    });
    unsubscribe();
  });
});
