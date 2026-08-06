import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Tag } from '../../../../shared/constants/tags.ts';
import type { DocsIndexEntry, IndexEntry, StoryIndex } from '../../../../types/modules/indexer.ts';
import { buildStaticFiles, clearRegistry, getService } from '../../server.ts';
import { registerTestModuleGraphService } from '../module-graph/module-graph.test-helpers.ts';
import { registerDocgenService } from './server.ts';
import type { DocgenPayload, DocgenProvider } from './types.ts';

beforeEach(() => {
  // registerDocgenService subscribes to `core/module-graph` and fails hard when it is missing, so
  // the dependency must be registered first (mirroring the dev-server, where it always is).
  registerTestModuleGraphService('/repo');
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

function makeDocgenPayload(overrides: Partial<DocgenPayload> = {}): DocgenPayload {
  return {
    id: 'button',
    name: 'Button',
    path: './button.stories.tsx',
    jsDocTags: {},
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

describe('docgen open service', () => {
  describe('extractDocgen command', () => {
    it('hands the resolved index entry to the provider, stores its payload, and returns it', async () => {
      const entry = makeStoryEntry('button--secondary', 'Button');
      const payload = makeDocgenPayload({ description: 'A button' });
      const provider = vi.fn<DocgenProvider>(async () => payload);

      const service = registerDocgenService({
        getIndex: makeGetIndex([entry]),
        docgenProvider: provider,
      });

      const returned = await service.commands.extractDocgen({ id: 'button' });

      expect(returned).toEqual(payload);
      expect(service.queries.docgen.get({ id: 'button' })).toEqual(payload);

      expect(provider).toHaveBeenCalledTimes(1);
      expect(provider.mock.calls[0][0]).toEqual({ entry });
    });

    it('prefers a story index entry over attached docs for the same component id', async () => {
      const storyEntry = makeStoryEntry('comp--default', 'Comp');
      const docsEntry = {
        id: 'comp--docs',
        name: 'Docs',
        title: 'Comp/Docs',
        type: 'docs',
        importPath: './comp.mdx',
        storiesImports: ['./wrong.stories.tsx'],
        tags: [Tag.ATTACHED_MDX, 'docs'],
      } satisfies DocsIndexEntry;

      const provider = vi.fn<DocgenProvider>(async () => makeDocgenPayload({ id: 'comp' }));

      const service = registerDocgenService({
        getIndex: makeGetIndex([docsEntry, storyEntry]),
        docgenProvider: provider,
      });

      await service.commands.extractDocgen({ id: 'comp' });

      expect(provider.mock.calls[0][0]).toEqual({ entry: storyEntry });
    });

    it('returns undefined and leaves state untouched when the provider returns undefined', async () => {
      const service = registerDocgenService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        docgenProvider: async () => undefined,
      });

      const returned = await service.commands.extractDocgen({ id: 'button' });

      expect(returned).toBeUndefined();
      expect(service.queries.docgen.get({ id: 'button' })).toBeUndefined();
    });

    it('throws when no entry exists for the component id', async () => {
      const service = registerDocgenService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        docgenProvider: async () => undefined,
      });

      await expect(service.commands.extractDocgen({ id: 'unknown' })).rejects.toThrow(
        /No story or attached docs entry was found for component id "unknown"/
      );
    });

    it('propagates provider errors out of the command', async () => {
      const service = registerDocgenService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        docgenProvider: async () => {
          throw new Error('provider blew up');
        },
      });

      await expect(service.commands.extractDocgen({ id: 'button' })).rejects.toThrow(
        'provider blew up'
      );
    });
  });

  describe('docgenForAllComponents query', () => {
    it('returns every extracted component without filtering', async () => {
      const manifestStory = {
        ...makeStoryEntry('button--primary', 'Button'),
        tags: [Tag.MANIFEST],
      };
      const otherStory = makeStoryEntry('card--default', 'Card');

      const service = registerDocgenService({
        getIndex: makeGetIndex([manifestStory, otherStory]),
        docgenProvider: async ({ entry }) =>
          makeDocgenPayload({
            id: entry.importPath.includes('button') ? 'button' : 'card',
            name: entry.importPath.includes('button') ? 'Button' : 'Card',
            path: entry.importPath,
          }),
      });

      await expect(service.queries.docgenForAllComponents.loaded()).resolves.toEqual({
        button: makeDocgenPayload({
          id: 'button',
          name: 'Button',
          path: './button.stories.tsx',
        }),
        card: makeDocgenPayload({
          id: 'card',
          name: 'Card',
          path: './card.stories.tsx',
        }),
      });
    });
  });

  describe('extractAllDocgen command', () => {
    it('records one component`s failure without dropping every other component`s payload', async () => {
      const service = registerDocgenService({
        getIndex: makeGetIndex([
          makeStoryEntry('button--primary', 'Button'),
          makeStoryEntry('card--default', 'Card'),
        ]),
        docgenProvider: async ({ entry }) => {
          if (entry.importPath.includes('button')) {
            throw new TypeError('provider blew up');
          }
          return makeDocgenPayload({ id: 'card', name: 'Card', path: entry.importPath });
        },
      });

      await service.commands.extractAllDocgen(undefined);
      await expect(service.commands.extractAllDocgen(undefined)).resolves.toBeUndefined();

      expect(service.queries.docgen.get({ id: 'card' })).toEqual(
        makeDocgenPayload({ id: 'card', name: 'Card', path: './card.stories.tsx' })
      );
      expect(service.queries.docgen.get({ id: 'button' })).toEqual({
        id: 'button',
        name: 'Button',
        path: './button.stories.tsx',
        jsDocTags: {},
        error: { name: 'TypeError', message: 'provider blew up' },
      });
    });

    it('stores the newer component-local error when overlapping bulk extractions reject', async () => {
      const rejections: Array<(error: Error) => void> = [];
      const provider = vi.fn<DocgenProvider>(
        () =>
          new Promise<DocgenPayload>((_resolve, reject) => {
            rejections.push(reject);
          })
      );
      const service = registerDocgenService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        docgenProvider: provider,
      });

      const older = service.commands.extractAllDocgen(undefined);
      const newer = service.commands.extractAllDocgen(undefined);
      await vi.waitFor(() => expect(rejections).toHaveLength(2));
      rejections[1](new Error('newer bulk failure'));
      await expect(newer).resolves.toBeUndefined();
      rejections[0](new Error('older bulk failure'));
      await expect(older).resolves.toBeUndefined();

      expect(service.queries.docgen.get({ id: 'button' })?.error?.message).toBe(
        'newer bulk failure'
      );
    });
  });

  describe('docgen query', () => {
    it('returns undefined synchronously when nothing has been extracted yet', async () => {
      const service = registerDocgenService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        docgenProvider: async () => makeDocgenPayload(),
      });

      expect(service.queries.docgen.get({ id: 'button' })).toBeUndefined();
    });

    it('.loaded() drives the load body which calls extractDocgen', async () => {
      const service = registerDocgenService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        docgenProvider: async () => makeDocgenPayload({ description: 'from-loaded' }),
      });

      await expect(service.queries.docgen.loaded({ id: 'button' })).resolves.toEqual(
        makeDocgenPayload({ description: 'from-loaded' })
      );
    });

    it('.loaded() surfaces missing-component errors from the command', async () => {
      const service = registerDocgenService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        docgenProvider: async () => undefined,
      });

      await expect(service.queries.docgen.loaded({ id: 'unknown' })).rejects.toThrow(
        /No story or attached docs entry was found for component id "unknown"/
      );
    });
  });

  describe('module graph hot refresh', () => {
    it('refreshes already-extracted components without loading every bumped component', async () => {
      const buttonEntry = makeStoryEntry('button--primary', 'Button');
      const cardEntry = makeStoryEntry('card--primary', 'Card');
      const provider = vi.fn<DocgenProvider>(async ({ entry }) =>
        makeDocgenPayload({
          id: entry.id.split('--')[0],
          name: entry.title,
          path: entry.importPath,
        })
      );
      const service = registerDocgenService({
        getIndex: makeGetIndex([buttonEntry, cardEntry]),
        docgenProvider: provider,
      });

      await service.queries.docgen.loaded({ id: 'button' });

      const moduleGraph = getService('core/module-graph', { internal: true });
      await moduleGraph.commands._applyGraphUpdate({
        storiesByFile: {},
        bumpedStoryFiles: ['./button.stories.tsx', './card.stories.tsx'],
      });

      await vi.waitFor(() =>
        expect(provider.mock.calls.map(([input]) => input.entry.importPath)).toEqual([
          './button.stories.tsx',
          './button.stories.tsx',
        ])
      );
    });

    it('refreshes already-extracted components when their story file changes', async () => {
      const buttonEntry = makeStoryEntry('button--primary', 'Button');
      const cardEntry = makeStoryEntry('card--primary', 'Card');
      const provider = vi.fn<DocgenProvider>(async ({ entry }) =>
        makeDocgenPayload({
          id: entry.id.split('--')[0],
          name: entry.title,
          path: entry.importPath,
        })
      );
      const service = registerDocgenService({
        getIndex: makeGetIndex([buttonEntry, cardEntry]),
        docgenProvider: provider,
      });

      await service.queries.docgen.loaded({ id: 'button' });

      const moduleGraph = getService('core/module-graph', { internal: true });
      await moduleGraph.commands._applyGraphUpdate({
        storiesByFile: {},
        bumpedStoryFiles: ['./button.stories.tsx'],
      });

      await vi.waitFor(() =>
        expect(provider.mock.calls.map(([input]) => input.entry.importPath)).toEqual([
          './button.stories.tsx',
          './button.stories.tsx',
        ])
      );
    });

    it('evicts a cached component when index removal follows Compodoc completion', async () => {
      let currentEntries: IndexEntry[] = [makeStoryEntry('card--primary', 'Card')];
      const service = registerDocgenService({
        workingDir: '/repo',
        getIndex: async () => makeGetIndex(currentEntries)(),
        docgenProvider: async ({ entry, generation }) =>
          makeDocgenPayload({
            id: 'card',
            name: 'Card',
            path: entry.importPath,
            description: `generation-${generation ?? 0}`,
          }),
      });
      await service.commands.extractDocgen({ id: 'card' });

      // Compodoc can complete before Storybook publishes the corresponding index removal.
      await service.commands._refreshDocgenForFiles({
        files: ['/repo/tsconfig.json'],
        generation: 7,
        invalidation: 'global',
      });
      expect(service.queries.docgen.get({ id: 'card' })?.description).toBe('generation-7');

      currentEntries = [];
      const moduleGraph = getService('core/module-graph', { internal: true });
      await moduleGraph.commands._applyGraphUpdate({
        storiesByFile: {},
        bumpedStoryFiles: ['./card.stories.tsx'],
      });

      await vi.waitFor(() => expect(service.queries.docgen.get({ id: 'card' })).toBeUndefined());
    });
  });

  describe('completion-driven file refresh', () => {
    const installReadyGraph = async () => {
      const moduleGraph = getService('core/module-graph', { internal: true });
      await moduleGraph.commands._applyGraphSnapshot({
        storiesByFile: {
          './src/button.component.ts': { './button.stories.tsx': 1 },
          './src/card.component.ts': { './card.stories.tsx': 1 },
        },
      });
      return moduleGraph;
    };

    it('maps changed files and refreshes only affected components that are already cached', async () => {
      const provider = vi.fn<DocgenProvider>(async ({ entry, generation }) =>
        makeDocgenPayload({
          id: entry.title.toLowerCase(),
          name: entry.title,
          path: entry.importPath,
          description: `generation-${generation ?? 0}`,
        })
      );
      const service = registerDocgenService({
        workingDir: '/repo',
        getIndex: makeGetIndex([
          makeStoryEntry('button--primary', 'Button'),
          makeStoryEntry('card--primary', 'Card'),
        ]),
        docgenProvider: provider,
      });
      await installReadyGraph();
      await service.queries.docgen.loaded({ id: 'button' });
      await service.queries.docgen.loaded({ id: 'card' });
      provider.mockClear();

      await service.commands._refreshDocgenForFiles({
        files: ['/repo/src/button.component.ts'],
        generation: 7,
        invalidation: 'files',
      });

      expect(provider).toHaveBeenCalledTimes(1);
      expect(provider.mock.calls[0][0]).toMatchObject({
        entry: { importPath: './button.stories.tsx' },
        generation: 7,
      });
      expect(service.queries.docgen.get({ id: 'button' })?.description).toBe('generation-7');
      expect(service.queries.docgen.get({ id: 'card' })?.description).toBe('generation-0');
    });

    it('refreshes every cached component for a global selection invalidation', async () => {
      const provider = vi.fn<DocgenProvider>(async ({ entry, generation }) =>
        makeDocgenPayload({
          id: entry.title.toLowerCase(),
          name: entry.title,
          path: entry.importPath,
          description: `generation-${generation ?? 0}`,
        })
      );
      const service = registerDocgenService({
        workingDir: '/repo',
        getIndex: makeGetIndex([
          makeStoryEntry('button--primary', 'Button'),
          makeStoryEntry('card--primary', 'Card'),
        ]),
        docgenProvider: provider,
      });
      await installReadyGraph();
      await service.queries.docgen.loaded({ id: 'button' });
      await service.queries.docgen.loaded({ id: 'card' });
      provider.mockClear();

      await service.commands._refreshDocgenForFiles({
        files: ['/repo/tsconfig.json'],
        generation: 8,
        invalidation: 'global',
      });

      expect(provider).toHaveBeenCalledTimes(2);
      expect(provider.mock.calls.map(([input]) => input.generation)).toEqual([8, 8]);
      expect(service.queries.docgen.get({ id: 'button' })?.description).toBe('generation-8');
      expect(service.queries.docgen.get({ id: 'card' })?.description).toBe('generation-8');
    });

    it('evicts removed cached ids and suppresses their older in-flight extraction', async () => {
      const cardEntry = makeStoryEntry('card--primary', 'Card');
      let currentEntries: IndexEntry[] = [cardEntry];
      let resolveStale!: (payload: DocgenPayload) => void;
      const stalePayload = new Promise<DocgenPayload>((resolve) => {
        resolveStale = resolve;
      });
      let blockCard = false;
      const provider = vi.fn<DocgenProvider>(async () =>
        blockCard ? stalePayload : makeDocgenPayload({ id: 'card', name: 'Card' })
      );
      const service = registerDocgenService({
        workingDir: '/repo',
        getIndex: async () => makeGetIndex(currentEntries)(),
        docgenProvider: provider,
      });
      await installReadyGraph();
      await service.commands.extractDocgen({ id: 'card' });
      blockCard = true;
      const staleExtraction = service.commands.extractDocgen({ id: 'card' });
      await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(2));

      currentEntries = [];
      await service.commands._refreshDocgenForFiles({
        files: ['/repo/tsconfig.json'],
        generation: 9,
        invalidation: 'global',
      });
      expect(service.queries.docgen.get({ id: 'card' })).toBeUndefined();

      resolveStale(makeDocgenPayload({ id: 'card', description: 'stale removed payload' }));
      await expect(staleExtraction).rejects.toThrow(
        /No story or attached docs entry was found for component id "card"/
      );
      expect(service.queries.docgen.get({ id: 'card' })).toBeUndefined();
    });

    it('does not let an extraction waiting behind a newer operation repopulate an evicted id', async () => {
      const cardEntry = makeStoryEntry('card--primary', 'Card');
      let currentEntries: IndexEntry[] = [cardEntry];
      const pending: Array<(payload: DocgenPayload) => void> = [];
      const provider = vi.fn<DocgenProvider>(
        () =>
          new Promise<DocgenPayload>((resolve) => {
            pending.push(resolve);
          })
      );
      const service = registerDocgenService({
        workingDir: '/repo',
        getIndex: async () => makeGetIndex(currentEntries)(),
        docgenProvider: provider,
      });
      await installReadyGraph();

      const older = service.commands.extractDocgen({ id: 'card' });
      const newer = service.commands.extractDocgen({ id: 'card' });
      await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(2));

      pending[0](makeDocgenPayload({ id: 'card', description: 'older payload' }));
      currentEntries = [];
      await service.commands._refreshDocgenForFiles({
        files: ['/repo/tsconfig.json'],
        generation: 9,
        invalidation: 'global',
      });
      pending[1](makeDocgenPayload({ id: 'card', description: 'newer payload' }));

      await expect(older).rejects.toThrow(
        /No story or attached docs entry was found for component id "card"/
      );
      await expect(newer).rejects.toThrow(
        /No story or attached docs entry was found for component id "card"/
      );
      expect(service.queries.docgen.get({ id: 'card' })).toBeUndefined();
    });

    it('does not let a stale missing-index lookup evict a newer re-added component', async () => {
      const cardEntry = makeStoryEntry('card--primary', 'Card');
      let resolveMissingLookup!: (index: StoryIndex) => void;
      const missingLookup = new Promise<StoryIndex>((resolve) => {
        resolveMissingLookup = resolve;
      });
      const getIndex = vi
        .fn<() => Promise<StoryIndex>>()
        .mockImplementationOnce(async () => missingLookup)
        .mockImplementation(async () => makeGetIndex([cardEntry])());
      const provider = vi.fn<DocgenProvider>(async () =>
        makeDocgenPayload({ id: 'card', description: 're-added payload' })
      );
      const service = registerDocgenService({
        workingDir: '/repo',
        getIndex,
        docgenProvider: provider,
      });

      const staleMissing = service.commands.extractDocgen({ id: 'card' });
      await vi.waitFor(() => expect(getIndex).toHaveBeenCalledOnce());
      const reAdded = service.commands.extractDocgen({ id: 'card' });
      await expect(reAdded).resolves.toMatchObject({ description: 're-added payload' });

      resolveMissingLookup(await makeGetIndex([])());
      await expect(staleMissing).resolves.toMatchObject({ description: 're-added payload' });
      expect(service.queries.docgen.get({ id: 'card' })?.description).toBe('re-added payload');
    });

    it('refreshes in-flight components during a global selection invalidation', async () => {
      let resolveInitialCard!: (payload: DocgenPayload) => void;
      const initialCard = new Promise<DocgenPayload>((resolve) => {
        resolveInitialCard = resolve;
      });
      const provider = vi.fn<DocgenProvider>(async ({ entry, generation }) => {
        if (entry.title === 'Card' && generation === undefined) {
          return initialCard;
        }
        return makeDocgenPayload({
          id: entry.title.toLowerCase(),
          name: entry.title,
          path: entry.importPath,
          description: `generation-${generation ?? 0}`,
        });
      });
      const service = registerDocgenService({
        workingDir: '/repo',
        getIndex: makeGetIndex([
          makeStoryEntry('button--primary', 'Button'),
          makeStoryEntry('card--primary', 'Card'),
        ]),
        docgenProvider: provider,
      });
      await installReadyGraph();
      await service.commands.extractDocgen({ id: 'button' });
      const staleCard = service.commands.extractDocgen({ id: 'card' });
      await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(2));

      await service.commands._refreshDocgenForFiles({
        files: ['/repo/tsconfig.json'],
        generation: 8,
        invalidation: 'global',
      });
      resolveInitialCard(makeDocgenPayload({ id: 'card', description: 'stale-card' }));

      await expect(staleCard).resolves.toMatchObject({ description: 'generation-8' });
      expect(service.queries.docgen.get({ id: 'button' })?.description).toBe('generation-8');
      expect(service.queries.docgen.get({ id: 'card' })?.description).toBe('generation-8');
    });

    it('waits for a booting module graph before mapping the completed provider cycle', async () => {
      const provider = vi.fn<DocgenProvider>(async () =>
        makeDocgenPayload({ description: 'after-graph-ready' })
      );
      const service = registerDocgenService({
        workingDir: '/repo',
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        docgenProvider: provider,
      });
      await service.queries.docgen.loaded({ id: 'button' });
      provider.mockClear();

      const moduleGraph = getService('core/module-graph', { internal: true });
      let releaseGraph!: () => void;
      const graphReady = new Promise<{ value: 'ready' }>((resolve) => {
        releaseGraph = () => resolve({ value: 'ready' });
      });
      vi.spyOn(moduleGraph.queries.status, 'loaded').mockImplementation(async () => graphReady);

      const refresh = service.commands._refreshDocgenForFiles({
        files: ['/repo/src/button.component.ts'],
        generation: 2,
        invalidation: 'files',
      });
      await Promise.resolve();
      expect(provider).not.toHaveBeenCalled();

      await moduleGraph.commands._applyGraphSnapshot({
        storiesByFile: {
          './src/button.component.ts': { './button.stories.tsx': 1 },
        },
      });
      releaseGraph();
      await refresh;

      expect(provider).toHaveBeenCalledOnce();
      expect(service.queries.docgen.get({ id: 'button' })?.description).toBe('after-graph-ready');
    });

    it('publishes the completion refresh after an earlier module-graph refresh read the last snapshot', async () => {
      let description = 'payload-A';
      const provider = vi.fn<DocgenProvider>(async () => makeDocgenPayload({ description }));
      const service = registerDocgenService({
        workingDir: '/repo',
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        docgenProvider: provider,
      });
      const moduleGraph = await installReadyGraph();
      await service.queries.docgen.loaded({ id: 'button' });
      provider.mockClear();

      // This models Vite's early source-file notification while Compodoc still exposes snapshot A.
      await moduleGraph.commands._applyGraphUpdate({
        storiesByFile: {
          './src/button.component.ts': { './button.stories.tsx': 1 },
          './src/card.component.ts': { './card.stories.tsx': 1 },
        },
        bumpedStoryFiles: ['./button.stories.tsx'],
      });
      await vi.waitFor(() =>
        expect(service.queries.docgen.get({ id: 'button' })?.description).toBe('payload-A')
      );

      description = 'payload-B';
      await service.commands._refreshDocgenForFiles({
        files: ['/repo/src/button.component.ts'],
        generation: 2,
        invalidation: 'files',
      });

      expect(provider).toHaveBeenCalledTimes(2);
      expect(service.queries.docgen.get({ id: 'button' })?.description).toBe('payload-B');
      expect(service.queries.docgen.get({ id: 'button' })?.error).toBeUndefined();
    });

    it('does nothing for unrelated files, empty hints, and uncached affected components', async () => {
      const provider = vi.fn<DocgenProvider>(async ({ entry }) =>
        makeDocgenPayload({ id: entry.title.toLowerCase(), path: entry.importPath })
      );
      const service = registerDocgenService({
        workingDir: '/repo',
        getIndex: makeGetIndex([
          makeStoryEntry('button--primary', 'Button'),
          makeStoryEntry('card--primary', 'Card'),
        ]),
        docgenProvider: provider,
      });
      await installReadyGraph();
      await service.queries.docgen.loaded({ id: 'button' });
      provider.mockClear();

      await service.commands._refreshDocgenForFiles({
        files: [],
        generation: 1,
        invalidation: 'files',
      });
      await service.commands._refreshDocgenForFiles({
        files: ['/repo/src/unrelated.ts'],
        generation: 2,
        invalidation: 'files',
      });
      await service.commands._refreshDocgenForFiles({
        files: ['/repo/src/card.component.ts'],
        generation: 3,
        invalidation: 'files',
      });

      expect(provider).not.toHaveBeenCalled();
    });

    it.each([
      ['unavailable', { value: 'unavailable' as const, reason: 'adapter absent' }],
      ['error', { value: 'error' as const, error: { message: 'graph failed' } }],
    ])('refreshes cached ids conservatively when the module graph is %s', async (_name, status) => {
      const provider = vi.fn<DocgenProvider>(async ({ entry }) =>
        makeDocgenPayload({ id: entry.title.toLowerCase(), path: entry.importPath })
      );
      const service = registerDocgenService({
        workingDir: '/repo',
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        docgenProvider: provider,
      });
      await service.queries.docgen.loaded({ id: 'button' });
      provider.mockClear();
      const moduleGraph = getService('core/module-graph', { internal: true });
      await moduleGraph.commands._setStatus(status);

      await service.commands._refreshDocgenForFiles({
        files: ['/any.ts'],
        generation: 4,
        invalidation: 'files',
      });

      expect(provider).toHaveBeenCalledOnce();
    });

    it('keeps the last good payload when a completion refresh provider fails', async () => {
      let fail = false;
      const provider = vi.fn<DocgenProvider>(async () => {
        if (fail) {
          throw new Error('reader failed');
        }
        return makeDocgenPayload({ description: 'last-good' });
      });
      const service = registerDocgenService({
        workingDir: '/repo',
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        docgenProvider: provider,
      });
      await installReadyGraph();
      await service.queries.docgen.loaded({ id: 'button' });
      fail = true;

      await expect(
        service.commands._refreshDocgenForFiles({
          files: ['/repo/src/button.component.ts'],
          generation: 5,
          invalidation: 'files',
        })
      ).rejects.toThrow('Failed to refresh');
      expect(service.queries.docgen.get({ id: 'button' })?.description).toBe('last-good');
    });

    it('applies the latest completed generation to later cached and previously unseen components', async () => {
      const provider = vi.fn<DocgenProvider>(async ({ entry, generation }) =>
        makeDocgenPayload({
          id: entry.title.toLowerCase(),
          name: entry.title,
          path: entry.importPath,
          description: `generation-${generation ?? 0}`,
        })
      );
      const service = registerDocgenService({
        workingDir: '/repo',
        getIndex: makeGetIndex([
          makeStoryEntry('button--primary', 'Button'),
          makeStoryEntry('card--primary', 'Card'),
        ]),
        docgenProvider: provider,
      });
      await installReadyGraph();
      await service.commands.extractDocgen({ id: 'button' });

      await service.commands._refreshDocgenForFiles({
        files: ['/repo/src/button.component.ts'],
        generation: 9,
        invalidation: 'files',
      });
      await service.commands.extractDocgen({ id: 'button' });
      await service.commands.extractDocgen({ id: 'card' });

      expect(provider.mock.calls.map(([input]) => input.generation ?? 0)).toEqual([0, 9, 9, 9]);
      expect(service.queries.docgen.get({ id: 'card' })?.description).toBe('generation-9');
    });

    it('lets an older successful in-flight extraction establish last-good data when refresh fails', async () => {
      let resolveInitial!: (payload: DocgenPayload) => void;
      const initialProvider = new Promise<DocgenPayload>((resolve) => {
        resolveInitial = resolve;
      });
      const provider = vi
        .fn<DocgenProvider>()
        .mockImplementationOnce(async () => initialProvider)
        .mockRejectedValueOnce(new Error('new snapshot reader failed'));
      const service = registerDocgenService({
        workingDir: '/repo',
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        docgenProvider: provider,
      });
      await installReadyGraph();

      const initialExtraction = service.commands.extractDocgen({ id: 'button' });
      await vi.waitFor(() => expect(provider).toHaveBeenCalledOnce());
      await expect(
        service.commands._refreshDocgenForFiles({
          files: ['/repo/src/button.component.ts'],
          generation: 10,
          invalidation: 'files',
        })
      ).rejects.toThrow('Failed to refresh');

      resolveInitial(makeDocgenPayload({ description: 'older-successful-fallback' }));
      await initialExtraction;

      expect(service.queries.docgen.get({ id: 'button' })?.description).toBe(
        'older-successful-fallback'
      );
    });

    it('keeps the newest stale success when two successes settle around a newer failure', async () => {
      let resolveOldest!: (payload: DocgenPayload) => void;
      let resolveNewest!: (payload: DocgenPayload) => void;
      const oldest = new Promise<DocgenPayload>((resolve) => {
        resolveOldest = resolve;
      });
      const newest = new Promise<DocgenPayload>((resolve) => {
        resolveNewest = resolve;
      });
      const provider = vi
        .fn<DocgenProvider>()
        .mockImplementationOnce(async () => oldest)
        .mockImplementationOnce(async () => newest)
        .mockRejectedValueOnce(new Error('new generation failed'));
      const service = registerDocgenService({
        workingDir: '/repo',
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        docgenProvider: provider,
      });
      await installReadyGraph();

      const oldestExtraction = service.commands.extractDocgen({ id: 'button' });
      const newestExtraction = service.commands.extractDocgen({ id: 'button' });
      await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(2));
      await expect(
        service.commands._refreshDocgenForFiles({
          files: ['/repo/src/button.component.ts'],
          generation: 10,
          invalidation: 'files',
        })
      ).rejects.toThrow('Failed to refresh');

      resolveNewest(makeDocgenPayload({ description: 'newest-last-good' }));
      await expect(newestExtraction).resolves.toMatchObject({ description: 'newest-last-good' });
      resolveOldest(makeDocgenPayload({ description: 'oldest-stale' }));
      await expect(oldestExtraction).resolves.toMatchObject({ description: 'newest-last-good' });

      expect(service.queries.docgen.get({ id: 'button' })?.description).toBe('newest-last-good');
    });

    it('waits for an intermediate newer success after the newest generation fails', async () => {
      let resolveOldest!: (payload: DocgenPayload) => void;
      let resolveIntermediate!: (payload: DocgenPayload) => void;
      const oldest = new Promise<DocgenPayload>((resolve) => {
        resolveOldest = resolve;
      });
      const intermediate = new Promise<DocgenPayload>((resolve) => {
        resolveIntermediate = resolve;
      });
      const provider = vi
        .fn<DocgenProvider>()
        .mockImplementationOnce(async () => oldest)
        .mockImplementationOnce(async () => intermediate)
        .mockRejectedValueOnce(new Error('newest generation failed'));
      const service = registerDocgenService({
        workingDir: '/repo',
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        docgenProvider: provider,
      });
      await installReadyGraph();

      const oldestExtraction = service.commands.extractDocgen({ id: 'button' });
      const intermediateExtraction = service.commands.extractDocgen({ id: 'button' });
      await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(2));
      await expect(
        service.commands._refreshDocgenForFiles({
          files: ['/repo/src/button.component.ts'],
          generation: 10,
          invalidation: 'files',
        })
      ).rejects.toThrow('Failed to refresh');

      let oldestSettled = false;
      void oldestExtraction.finally(() => {
        oldestSettled = true;
      });
      resolveOldest(makeDocgenPayload({ description: 'oldest-stale' }));
      await Promise.resolve();
      expect(oldestSettled).toBe(false);

      resolveIntermediate(makeDocgenPayload({ description: 'intermediate-last-good' }));
      await expect(intermediateExtraction).resolves.toMatchObject({
        description: 'intermediate-last-good',
      });
      await expect(oldestExtraction).resolves.toMatchObject({
        description: 'intermediate-last-good',
      });
    });

    it('stores the dominant refresh error for an older extract-all failure', async () => {
      let rejectInitial!: (error: Error) => void;
      const initial = new Promise<DocgenPayload>((_resolve, reject) => {
        rejectInitial = reject;
      });
      const provider = vi
        .fn<DocgenProvider>()
        .mockImplementationOnce(async () => initial)
        .mockRejectedValueOnce(new Error('dominant refresh failure'));
      const service = registerDocgenService({
        workingDir: '/repo',
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        docgenProvider: provider,
      });
      await installReadyGraph();

      const extractAll = service.commands.extractAllDocgen(undefined);
      await vi.waitFor(() => expect(provider).toHaveBeenCalledOnce());
      await expect(
        service.commands._refreshDocgenForFiles({
          files: ['/repo/src/button.component.ts'],
          generation: 12,
          invalidation: 'files',
        })
      ).rejects.toThrow('Failed to refresh');
      rejectInitial(new Error('stale extract-all failure'));

      await expect(extractAll).resolves.toBeUndefined();
      expect(service.queries.docgen.get({ id: 'button' })?.error?.message).toBe(
        'dominant refresh failure'
      );
    });

    it('refreshes an affected in-flight id and suppresses its older rejection', async () => {
      let rejectInitial!: (error: Error) => void;
      const initialProvider = new Promise<DocgenPayload>((_resolve, reject) => {
        rejectInitial = reject;
      });
      const provider = vi
        .fn<DocgenProvider>()
        .mockImplementationOnce(async () => initialProvider)
        .mockImplementationOnce(async () =>
          makeDocgenPayload({ description: 'completion-authoritative' })
        );
      const service = registerDocgenService({
        workingDir: '/repo',
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        docgenProvider: provider,
      });
      await installReadyGraph();

      const initialExtraction = service.commands.extractAllDocgen(undefined);
      await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(1));
      await service.commands._refreshDocgenForFiles({
        files: ['/repo/src/button.component.ts'],
        generation: 8,
        invalidation: 'files',
      });
      expect(service.queries.docgen.get({ id: 'button' })?.description).toBe(
        'completion-authoritative'
      );

      rejectInitial(new Error('stale initial failure'));
      await initialExtraction;

      expect(service.queries.docgen.get({ id: 'button' })?.description).toBe(
        'completion-authoritative'
      );
      expect(service.queries.docgen.get({ id: 'button' })?.error).toBeUndefined();
    });

    it('returns the newer completed generation from a suppressed extract command', async () => {
      let resolveInitial!: (payload: DocgenPayload | undefined) => void;
      const initialProvider = new Promise<DocgenPayload | undefined>((resolve) => {
        resolveInitial = resolve;
      });
      const provider = vi
        .fn<DocgenProvider>()
        .mockImplementationOnce(async () => initialProvider)
        .mockResolvedValueOnce(makeDocgenPayload({ description: 'authoritative-refresh' }));
      const service = registerDocgenService({
        workingDir: '/repo',
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        docgenProvider: provider,
      });
      await installReadyGraph();

      const initialExtraction = service.commands.extractDocgen({ id: 'button' });
      await vi.waitFor(() => expect(provider).toHaveBeenCalledOnce());
      await service.commands._refreshDocgenForFiles({
        files: ['/repo/src/button.component.ts'],
        generation: 11,
        invalidation: 'files',
      });
      resolveInitial(undefined);

      await expect(initialExtraction).resolves.toMatchObject({
        description: 'authoritative-refresh',
      });
      expect(service.queries.docgen.get({ id: 'button' })?.description).toBe(
        'authoritative-refresh'
      );
    });

    it('adopts a newer refresh failure when an older in-flight extraction also rejects', async () => {
      let rejectInitial!: (error: Error) => void;
      const initialProvider = new Promise<DocgenPayload>((_resolve, reject) => {
        rejectInitial = reject;
      });
      const provider = vi
        .fn<DocgenProvider>()
        .mockImplementationOnce(async () => initialProvider)
        .mockRejectedValueOnce(new Error('authoritative refresh failure'));
      const service = registerDocgenService({
        workingDir: '/repo',
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        docgenProvider: provider,
      });
      await installReadyGraph();

      const initialExtraction = service.commands.extractDocgen({ id: 'button' });
      await vi.waitFor(() => expect(provider).toHaveBeenCalledOnce());
      await expect(
        service.commands._refreshDocgenForFiles({
          files: ['/repo/src/button.component.ts'],
          generation: 12,
          invalidation: 'files',
        })
      ).rejects.toThrow('Failed to refresh');
      rejectInitial(new Error('stale initial failure'));

      await expect(initialExtraction).rejects.toThrow('authoritative refresh failure');
      expect(service.queries.docgen.get({ id: 'button' })).toBeUndefined();
    });

    it('serializes generations and ignores duplicate or older completion notifications', async () => {
      const calls: number[] = [];
      const provider = vi.fn<DocgenProvider>(async ({ generation }) => {
        calls.push(generation ?? 0);
        return makeDocgenPayload({ description: `generation-${generation ?? 0}` });
      });
      const service = registerDocgenService({
        workingDir: '/repo',
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        docgenProvider: provider,
      });
      await installReadyGraph();
      await service.queries.docgen.loaded({ id: 'button' });

      await Promise.all([
        service.commands._refreshDocgenForFiles({
          files: ['/repo/src/button.component.ts'],
          generation: 6,
          invalidation: 'files',
        }),
        service.commands._refreshDocgenForFiles({
          files: ['/repo/src/button.component.ts'],
          generation: 7,
          invalidation: 'files',
        }),
        service.commands._refreshDocgenForFiles({
          files: ['/repo/src/button.component.ts'],
          generation: 6,
          invalidation: 'files',
        }),
      ]);

      expect(calls).toEqual([0, 6, 7]);
      expect(service.queries.docgen.get({ id: 'button' })?.description).toBe('generation-7');
    });
  });

  describe('static build', () => {
    it('does not request docgen for component ids that only exist on unattached docs entries', async () => {
      const storyEntry = makeStoryEntry('button--primary', 'Button');
      const unattachedDocs = {
        id: 'orphan--docs',
        name: 'Docs',
        title: 'Orphan/Docs',
        type: 'docs',
        importPath: './orphan.mdx',
        storiesImports: [],
        tags: [Tag.UNATTACHED_MDX, 'docs'],
      } satisfies DocsIndexEntry;

      const provider = vi.fn<DocgenProvider>(async () => makeDocgenPayload());

      registerDocgenService({
        getIndex: makeGetIndex([storyEntry, unattachedDocs]),
        docgenProvider: provider,
      });

      const store = await buildStaticFiles();

      expect(provider).toHaveBeenCalledTimes(1);
      expect(provider.mock.calls[0][0].entry).toEqual(storyEntry);
      expect(Object.keys(store)).toEqual(['core/docgen/button.json']);
    });

    it('writes one docgen JSON per component id whose provider produced a payload', async () => {
      registerDocgenService({
        getIndex: makeGetIndex([
          makeStoryEntry('button--primary', 'Button'),
          makeStoryEntry('button--secondary', 'Button'),
          makeStoryEntry('card--default', 'Card'),
        ]),
        docgenProvider: async ({ entry }) => {
          const isButton = entry.importPath.includes('button');
          return makeDocgenPayload({
            id: isButton ? 'button' : 'card',
            name: isButton ? 'Button' : 'Card',
            path: entry.importPath,
            description: `from ${entry.importPath}`,
          });
        },
      });

      const store = await buildStaticFiles();

      expect(Object.keys(store).sort()).toEqual([
        'core/docgen/button.json',
        'core/docgen/card.json',
      ]);
      expect(store['core/docgen/button.json']).toMatchObject({
        components: {
          button: {
            id: 'button',
            name: 'Button',
            path: './button.stories.tsx',
            description: 'from ./button.stories.tsx',
            jsDocTags: {},
          },
        },
      });
    });
  });

  describe('provider middleware composition', () => {
    it('lets a wrapping provider delegate to nextDocgen and merge its output', async () => {
      const inner: DocgenProvider = async () => makeDocgenPayload({ name: 'inner-name' });

      const outer: DocgenProvider = async (input) => {
        const downstream = await inner(input);
        if (!downstream) {
          return undefined;
        }
        return { ...downstream, description: 'outer-description' };
      };

      const service = registerDocgenService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        docgenProvider: outer,
      });

      await expect(service.queries.docgen.loaded({ id: 'button' })).resolves.toEqual(
        makeDocgenPayload({ name: 'inner-name', description: 'outer-description' })
      );
    });

    it('merges output from three stacked providers (identity → A → B)', async () => {
      const identity: DocgenProvider = async () => undefined;

      const providerA: DocgenProvider = async (input) => {
        await identity(input);
        return makeDocgenPayload({ name: 'A-name' });
      };

      const providerB: DocgenProvider = async (input) => {
        const downstream = await providerA(input);
        if (!downstream) {
          return undefined;
        }
        return {
          ...downstream,
          description: `${downstream.description ?? ''}B-description`,
        };
      };

      const service = registerDocgenService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        docgenProvider: providerB,
      });

      await expect(service.queries.docgen.loaded({ id: 'button' })).resolves.toEqual(
        makeDocgenPayload({
          name: 'A-name',
          description: 'B-description',
        })
      );
    });

    it('propagates undefined from the bottom of the chain when no provider has docgen', async () => {
      const identity: DocgenProvider = async () => undefined;
      const passthrough: DocgenProvider = async (input) => identity(input);

      const service = registerDocgenService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        docgenProvider: passthrough,
      });

      await service.commands.extractDocgen({ id: 'button' });
      expect(service.queries.docgen.get({ id: 'button' })).toBeUndefined();
    });
  });
});
