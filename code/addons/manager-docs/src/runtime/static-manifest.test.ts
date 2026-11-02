import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import type { StoryIndex } from 'storybook/internal/types';

import { clearRegistry } from '../../../../core/src/shared/open-service/server.ts';

import { registerMdxSourceService } from '../mdx-source-service/server.ts';
import { openDocsPage, openDocsPageFromSource } from './docs-page.ts';
import { loadDocsArticle } from './static-manifest.ts';

const source = readFileSync(
  fileURLToPath(new URL('./fixtures/Button.mdx', import.meta.url)),
  'utf8'
);

const entries = [
  {
    type: 'docs',
    id: 'button--docs',
    importPath: 'src/Button.mdx',
  },
  {
    type: 'story',
    id: 'button--primary',
    importPath: 'src/Button.stories.ts',
    exportName: 'Primary',
    args: { label: 'Hello' },
  },
  {
    type: 'story',
    id: 'button--secondary',
    importPath: 'src/Button.stories.ts',
    exportName: 'Secondary',
    args: { label: 'Bye' },
  },
];

const globals = { viewport: 'desktop' };

function indexFrom(docsEntries: Array<{ id: string }>): StoryIndex {
  return {
    v: 5,
    entries: Object.fromEntries(docsEntries.map((entry) => [entry.id, entry])),
  } as StoryIndex;
}

describe('loadDocsArticle', () => {
  afterEach(() => {
    clearRegistry();
  });

  it('opens the same page model as a direct parse, through the MDX source service', async () => {
    registerMdxSourceService({
      read: async () => source,
      getIndex: async () => indexFrom(entries),
    });

    const viaService = await loadDocsArticle({
      file: 'src/Button.mdx',
      entries,
      globals,
    });
    const viaDirect = await openDocsPage({
      file: 'src/Button.mdx',
      entries,
      globals,
      readSource: async () => source,
    });

    expect(viaService.model).toEqual(viaDirect.model);
    expect(viaService.model.instances.map((instance) => instance.storyId)).toEqual([
      'button--primary',
      'button--secondary',
    ]);
    expect(viaService.model.instances.map((instance) => instance.focus)).toEqual([false, true]);
  });

  it('resolves stories from the full index when import paths start with ./', async () => {
    const docsFile = './src/Button.mdx';
    const indexed = [
      { type: 'docs', id: 'button--docs', importPath: docsFile },
      {
        type: 'story',
        id: 'button--primary',
        importPath: './src/Button.stories.ts',
        exportName: 'Primary',
        args: { label: 'Hello' },
      },
      {
        type: 'story',
        id: 'button--secondary',
        importPath: './src/Button.stories.tsx',
        exportName: 'Secondary',
        args: { label: 'Bye' },
      },
    ];
    registerMdxSourceService({
      read: async () => source,
      getIndex: async () => indexFrom(indexed),
    });

    const viaService = await loadDocsArticle({
      file: docsFile,
      entries: indexed,
      globals,
    });
    const direct = openDocsPageFromSource({
      file: docsFile,
      source,
      entries: indexed,
      globals,
    });

    expect(viaService.model).toEqual(direct.model);
    expect(direct.model.instances.map((instance) => instance.storyId)).toEqual([
      'button--primary',
      'button--secondary',
    ]);
    expect(direct.model.instances.map((instance) => instance.focus)).toEqual([false, true]);
    expect(direct.model.instances.map((instance) => instance.args)).toEqual([
      { label: 'Hello' },
      { label: 'Bye' },
    ]);
  });
});
