import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import type { IndexEntry, StoryIndex } from '../../../../types/modules/indexer.ts';
import { clearRegistry, getService } from '../../server.ts';
import { registerTestModuleGraphService } from '../module-graph/module-graph.test-helpers.ts';
import { registerStoryDocsService } from './server.ts';
import type { StoryDocsPayload, StoryDocsProvider } from './types.ts';

beforeEach(() => {
  registerTestModuleGraphService();
});

afterEach(() => {
  clearRegistry();
});

function makeStoryEntry(id: string, title = 'Comp'): IndexEntry {
  return {
    id,
    name: id.split('--').slice(1).join('--') || 'Default',
    title,
    type: 'story',
    subtype: 'story',
    importPath: `./${title.toLowerCase()}.stories.tsx`,
  };
}

function makeStoryDocsPayload(overrides: Partial<StoryDocsPayload> = {}): StoryDocsPayload {
  return {
    id: 'button',
    name: 'Button',
    path: './button.stories.tsx',
    stories: {},
    ...overrides,
  };
}

function makeGetIndex(entries: IndexEntry[]) {
  const index: StoryIndex = {
    v: 5,
    entries: Object.fromEntries(entries.map((entry) => [entry.id, entry])),
  };
  return () => Promise.resolve(index);
}

describe('story-docs open service', () => {
  it('stores and returns story-docs payloads from the provider', async () => {
    const entry = makeStoryEntry('button--primary', 'Button');
    const payload = makeStoryDocsPayload({
      stories: {
        'button--primary': { id: 'button--primary', name: 'Primary', snippet: '<Button />' },
      },
    });
    const provider = vi.fn<StoryDocsProvider>(async () => payload);

    const service = registerStoryDocsService({
      getIndex: makeGetIndex([entry]),
      storyDocsProvider: provider,
    });

    await expect(service.commands.extractStoryDocs({ id: 'button' })).resolves.toEqual(payload);
    expect(service.queries.storyDocs.get({ id: 'button' })).toEqual(payload);
    expect(provider).toHaveBeenCalledWith({ entry });
  });

  describe('shared component ids across CSF files', () => {
    let provider: Mock<StoryDocsProvider>;

    beforeEach(() => {
      provider = vi.fn();
    });

    function makeSiblingEntries() {
      // Same componentId ('vega'), different files. Insertion order makes the
      // second file the selected winner, mirroring selectComponentEntriesByComponentId.
      const fileA = {
        ...makeStoryEntry('vega--a', 'Vega'),
        importPath: './a.stories.tsx',
      };
      const fileB = {
        ...makeStoryEntry('vega--b', 'Vega'),
        importPath: './b.stories.tsx',
      };
      return { fileA, fileB };
    }

    it('merges stories from every file sharing the component id', async () => {
      const { fileA, fileB } = makeSiblingEntries();
      vi.mocked(provider).mockImplementation(async ({ entry }) =>
        makeStoryDocsPayload({
          id: 'vega',
          name: 'Vega',
          path: entry.importPath,
          stories: { [entry.id]: { id: entry.id, name: entry.id } },
        })
      );

      const service = registerStoryDocsService({
        getIndex: makeGetIndex([fileA, fileB]),
        storyDocsProvider: provider,
      });

      const result = await service.commands.extractStoryDocs({ id: 'vega' });
      expect(Object.keys(result?.stories ?? {}).sort()).toEqual(['vega--a', 'vega--b']);
      // Winner file (fileB) keeps its identity fields.
      expect(result?.path).toBe('./b.stories.tsx');
    });

    it('prefers the winning file on story-id collisions', async () => {
      const { fileA, fileB } = makeSiblingEntries();
      vi.mocked(provider).mockImplementation(async ({ entry }) =>
        makeStoryDocsPayload({
          id: 'vega',
          name: 'Vega',
          path: entry.importPath,
          stories: { 'vega--shared': { id: 'vega--shared', name: entry.importPath } },
        })
      );

      const service = registerStoryDocsService({
        getIndex: makeGetIndex([fileA, fileB]),
        storyDocsProvider: provider,
      });

      const result = await service.commands.extractStoryDocs({ id: 'vega' });
      expect(result?.stories['vega--shared']?.name).toBe('./b.stories.tsx');
    });

    it('keeps the winning file stories when a sibling extraction fails', async () => {
      const { fileA, fileB } = makeSiblingEntries();
      vi.mocked(provider).mockImplementation(async ({ entry }) => {
        if (entry.id === 'vega--a') {
          throw new Error('sibling boom');
        }
        return makeStoryDocsPayload({
          id: 'vega',
          name: 'Vega',
          path: entry.importPath,
          stories: { [entry.id]: { id: entry.id, name: entry.id } },
        });
      });

      const service = registerStoryDocsService({
        getIndex: makeGetIndex([fileA, fileB]),
        storyDocsProvider: provider,
      });

      const result = await service.commands.extractStoryDocs({ id: 'vega' });
      expect(Object.keys(result?.stories ?? {})).toEqual(['vega--b']);
    });
  });

  describe('module graph hot refresh', () => {
    // Snippets come from the story file's own source. Already-extracted components must re-extract
    // when their story file changes so snippets stay fresh after the edit.
    it('re-extracts already-extracted components when their story file changes', async () => {
      const entry = makeStoryEntry('button--primary', 'Button');
      const provider = vi.fn<StoryDocsProvider>(async () => makeStoryDocsPayload());
      const service = registerStoryDocsService({
        getIndex: makeGetIndex([entry]),
        storyDocsProvider: provider,
      });

      await service.queries.storyDocs.loaded({ id: 'button' });
      expect(provider).toHaveBeenCalledTimes(1);

      const moduleGraph = getService('core/module-graph', { internal: true });
      await moduleGraph.commands._applyGraphUpdate({
        bumpedStoryFiles: ['./button.stories.tsx'],
      });

      await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(2));
    });

    it('does not re-extract components that were never extracted', async () => {
      const provider = vi.fn<StoryDocsProvider>(async () => makeStoryDocsPayload());
      registerStoryDocsService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        storyDocsProvider: provider,
      });

      const moduleGraph = getService('core/module-graph', { internal: true });
      await moduleGraph.commands._applyGraphUpdate({
        bumpedStoryFiles: ['./button.stories.tsx'],
      });

      // Nothing was extracted, so the story-file update has no component to refresh.
      await expect(vi.waitFor(() => expect(provider).toHaveBeenCalled())).rejects.toThrow();
    });
  });
});
