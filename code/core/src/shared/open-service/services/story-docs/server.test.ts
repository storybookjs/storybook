import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IndexEntry, StoryIndex } from '../../../../types/modules/indexer.ts';
import { clearRegistry, getService } from '../../server.ts';
import type { ModuleGraphService } from '../module-graph/definition.ts';
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
      provider,
    });

    await expect(service.commands.extractStoryDocs({ id: 'button' })).resolves.toEqual(payload);
    expect(service.queries.getStoryDocs({ id: 'button' })).toEqual(payload);
    expect(provider).toHaveBeenCalledWith({ entry });
  });

  describe('module graph hot refresh', () => {
    // Snippets come from the story file's own source, and a story-file save fires a
    // story-index invalidation that bumps the revision with an empty change set. Already-extracted
    // components must still re-extract so snippets stay fresh after the edit.
    it('re-extracts already-extracted components on an empty-change-set revision bump', async () => {
      const entry = makeStoryEntry('button--primary', 'Button');
      const provider = vi.fn<StoryDocsProvider>(async () => makeStoryDocsPayload());
      const service = registerStoryDocsService({
        getIndex: makeGetIndex([entry]),
        provider,
      });

      await service.queries.getStoryDocs.loaded({ id: 'button' });
      expect(provider).toHaveBeenCalledTimes(1);

      const moduleGraph = getService<ModuleGraphService>('core/module-graph');
      await moduleGraph.commands._bumpGraphRevision(undefined);

      await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(2));
    });

    it('does not re-extract components that were never extracted', async () => {
      const provider = vi.fn<StoryDocsProvider>(async () => makeStoryDocsPayload());
      registerStoryDocsService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        provider,
      });

      const moduleGraph = getService<ModuleGraphService>('core/module-graph');
      await moduleGraph.commands._bumpGraphRevision(undefined);

      // Nothing was extracted, so the empty-change-set bump has no component to refresh.
      await expect(vi.waitFor(() => expect(provider).toHaveBeenCalled())).rejects.toThrow();
    });
  });
});
