import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

  // Core carries the snippet template without interpreting it, so the only thing that can go wrong
  // here is the schema quietly dropping a shape it does not model. It is the preview's only way to
  // rebuild a snippet in a static build, where there is no server left to ask.
  it('carries a framework-shaped snippet template through the payload without reshaping it', async () => {
    const snippetTemplate = {
      kind: 'angular-snippet-template',
      selector: 'sb-basic',
      inputNames: ['label'],
      outputs: ['pressed'],
      componentName: 'BasicComponent',
      standalone: true,
    };
    const payload = makeStoryDocsPayload({
      stories: {
        'button--primary': {
          id: 'button--primary',
          name: 'Primary',
          snippet: '<sb-basic />',
          snippetTemplate,
        },
      },
    });

    const service = registerStoryDocsService({
      getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
      storyDocsProvider: vi.fn<StoryDocsProvider>(async () => payload),
    });

    await service.commands.extractStoryDocs({ id: 'button' });

    expect(
      service.queries.storyDocs.get({ id: 'button' })?.stories['button--primary']?.snippetTemplate
    ).toEqual(snippetTemplate);
  });

  // Every new subscription seeds through the query's `load`. Docs blocks re-subscribe whenever what
  // they derive from the payload changes, so a `load` that re-extracted ran the whole provider -
  // a TS language-service docgen pass for Angular - once per Controls keystroke.
  it('does not re-run the provider for a component it has already extracted', async () => {
    const provider = vi.fn<StoryDocsProvider>(async () => makeStoryDocsPayload());
    const service = registerStoryDocsService({
      getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
      storyDocsProvider: provider,
    });

    await service.queries.storyDocs.loaded({ id: 'button' });
    await service.queries.storyDocs.loaded({ id: 'button' });
    await service.queries.storyDocs.loaded({ id: 'button' });

    expect(provider).toHaveBeenCalledTimes(1);
  });

  it('tries again when a provider failure left nothing cached', async () => {
    const payload = makeStoryDocsPayload();
    const provider = vi
      .fn<StoryDocsProvider>()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue(payload);
    const service = registerStoryDocsService({
      getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
      storyDocsProvider: provider,
    });

    await service.queries.storyDocs.loaded({ id: 'button' });
    expect(service.queries.storyDocs.get({ id: 'button' })).toBeUndefined();

    await service.queries.storyDocs.loaded({ id: 'button' });

    expect(provider).toHaveBeenCalledTimes(2);
    expect(service.queries.storyDocs.get({ id: 'button' })).toEqual(payload);
  });

  // `extractAllStoryDocs` stores an error payload for every component whose provider rejected, so
  // a load that treated any stored value as extracted would serve one transient failure for the
  // rest of the session.
  it('tries again when the cached payload is a stored extraction error', async () => {
    const payload = makeStoryDocsPayload();
    const provider = vi
      .fn<StoryDocsProvider>()
      .mockRejectedValueOnce(new Error('worker restarted'))
      .mockResolvedValue(payload);
    const service = registerStoryDocsService({
      getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
      storyDocsProvider: provider,
    });

    await service.commands.extractAllStoryDocs(undefined);
    expect(service.queries.storyDocs.get({ id: 'button' })?.error).toBeDefined();

    await service.queries.storyDocs.loaded({ id: 'button' });

    expect(provider).toHaveBeenCalledTimes(2);
    expect(service.queries.storyDocs.get({ id: 'button' })).toEqual(payload);
  });

  // The command is the "extract now" path and must stay unguarded, or the hot refresh below has no
  // way to pick up an edited story file.
  it('re-runs the provider when the extract command is called directly', async () => {
    const provider = vi.fn<StoryDocsProvider>(async () => makeStoryDocsPayload());
    const service = registerStoryDocsService({
      getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
      storyDocsProvider: provider,
    });

    await service.queries.storyDocs.loaded({ id: 'button' });
    await service.commands.extractStoryDocs({ id: 'button' });

    expect(provider).toHaveBeenCalledTimes(2);
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
