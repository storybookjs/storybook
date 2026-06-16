import { afterEach, describe, expect, it, vi } from 'vitest';

import { Tag } from 'storybook/internal/core-server';
import type { DocsIndexEntry, IndexEntry, StoryIndex } from 'storybook/internal/types';

import {
  buildStaticFiles,
  clearRegistry,
} from '../../../../core/src/shared/open-service/server.ts';
import { registerMdxService } from './server.ts';
import type { MdxProvider } from './types.ts';

afterEach(() => {
  clearRegistry();
});

function makeGetIndex(entries: IndexEntry[]) {
  const index: StoryIndex = {
    v: 5,
    entries: Object.fromEntries(entries.map((entry) => [entry.id, entry])),
  };
  return () => Promise.resolve(index);
}

function makeDocsEntry(id: string, tags: string[], storiesImports: string[] = []): DocsIndexEntry {
  return {
    id,
    name: 'Docs',
    title: id.split('--')[0],
    type: 'docs',
    importPath: `./${id}.mdx`,
    storiesImports,
    tags,
  };
}

const provider: MdxProvider = async ({ componentId, entries }) => ({
  id: componentId,
  name: componentId,
  docs: Object.fromEntries(
    entries.map((entry) => [
      entry.id,
      {
        id: entry.id,
        name: entry.name,
        path: entry.importPath,
        title: entry.title,
        content: `# ${entry.title}`,
      },
    ])
  ),
});

describe('mdx open service', () => {
  it('extracts attached MDX by component id and unattached MDX by docs id', async () => {
    const attachedDocs = makeDocsEntry(
      'button--docs',
      [Tag.MANIFEST, Tag.ATTACHED_MDX],
      ['./button.stories.tsx']
    );
    const unattachedDocs = makeDocsEntry('intro--docs', [Tag.MANIFEST, Tag.UNATTACHED_MDX]);
    const mockProvider = vi.fn<MdxProvider>(provider);

    const service = registerMdxService({
      getIndex: makeGetIndex([attachedDocs, unattachedDocs]),
      provider: mockProvider,
    });

    await expect(
      service.queries.getMdxForComponent.loaded({ id: 'button' })
    ).resolves.toMatchObject({
      id: 'button',
      docs: { 'button--docs': { content: '# button' } },
    });
    await expect(
      service.queries.getMdxForComponent.loaded({ id: 'intro--docs' })
    ).resolves.toMatchObject({
      id: 'intro--docs',
      docs: { 'intro--docs': { content: '# intro' } },
    });
  });

  it('does not extract anything until a query load is requested', async () => {
    const mockProvider = vi.fn<MdxProvider>(provider);

    registerMdxService({
      getIndex: makeGetIndex([
        makeDocsEntry('button--docs', [Tag.MANIFEST, Tag.ATTACHED_MDX], ['./button.stories.tsx']),
      ]),
      provider: mockProvider,
    });

    expect(mockProvider).not.toHaveBeenCalled();
  });

  it('builds one static JSON file per MDX component id', async () => {
    const mockProvider = vi.fn<MdxProvider>(provider);

    registerMdxService({
      getIndex: makeGetIndex([
        makeDocsEntry('button--docs', [Tag.MANIFEST, Tag.ATTACHED_MDX], ['./button.stories.tsx']),
        makeDocsEntry('intro--docs', [Tag.MANIFEST, Tag.UNATTACHED_MDX]),
        makeDocsEntry('ignored--docs', [Tag.ATTACHED_MDX], ['./ignored.stories.tsx']),
      ]),
      provider: mockProvider,
    });

    const store = await buildStaticFiles();

    expect(Object.keys(store).sort()).toEqual([
      'addon-docs/mdx/button.json',
      'addon-docs/mdx/ignored.json',
      'addon-docs/mdx/intro--docs.json',
    ]);
    expect(store['addon-docs/mdx/button.json']).toMatchObject({
      components: {
        button: {
          docs: { 'button--docs': { id: 'button--docs' } },
        },
      },
    });
    expect(store['addon-docs/mdx/ignored.json']).toMatchObject({
      components: {
        ignored: {
          docs: { 'ignored--docs': { id: 'ignored--docs' } },
        },
      },
    });
    expect(store['addon-docs/mdx/intro--docs.json']).toMatchObject({
      components: {
        'intro--docs': {
          docs: { 'intro--docs': { id: 'intro--docs' } },
        },
      },
    });
  });
});
