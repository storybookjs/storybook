import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { STORY_INDEX_INVALIDATED } from 'storybook/internal/core-events';

import { createTestChannel, type SpiedTestChannel } from '../../../../channels/test-channel.ts';
import { Tag } from '../../../../shared/constants/tags.ts';
import type { DocsIndexEntry, IndexEntry, StoryIndex } from '../../../../types/modules/indexer.ts';
import { buildStaticFiles, clearRegistry, getService } from '../../server.ts';
import { parseManifestRef } from '../../toolsets/docs/access-provider.ts';
import { readAllComponents } from '../component-state-key.ts';
import { registerTestModuleGraphService } from '../module-graph/module-graph.test-helpers.ts';
import { docgenManifestRef } from './paths.ts';
import { registerDocgenService, subscribeDocgenToModuleGraphChanges } from './server.ts';
import type { DocgenPayload, DocgenProvider } from './types.ts';

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
    it('announces every component entry before extracting them', async () => {
      const prepareDocgen = vi.fn();
      const button = makeStoryEntry('button--primary', 'Button');
      const service = registerDocgenService({
        getIndex: makeGetIndex([button]),
        docgenProvider: async () => {
          expect(prepareDocgen).toHaveBeenCalledWith([button]);
          return makeDocgenPayload();
        },
        prepareDocgen,
      });

      await service.commands.extractAllDocgen(undefined);

      expect(service.queries.docgen.get({ id: 'button' })).toEqual(makeDocgenPayload());
    });

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
  });

  describe('overlapping extractions', () => {
    it.each(['bulk', 'single'] as const)(
      'resolves docgenForAllComponents.loaded() with the newer payload when the %s extraction finishes first',
      async (finishesFirst) => {
        const bulk = Promise.withResolvers<DocgenPayload>();
        const single = Promise.withResolvers<DocgenPayload>();
        const provider = vi
          .fn<DocgenProvider>()
          .mockReturnValueOnce(bulk.promise)
          .mockReturnValueOnce(single.promise);
        const service = registerDocgenService({
          getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
          docgenProvider: provider,
        });

        const loading = service.queries.docgenForAllComponents.loaded();
        await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(1));
        const extracting = service.commands.extractDocgen({ id: 'button' });
        await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(2));
        const [first, second] = finishesFirst === 'bulk' ? [bulk, single] : [single, bulk];
        first.resolve(makeDocgenPayload({ description: finishesFirst === 'bulk' ? 'old' : 'new' }));
        await new Promise((resolve) => setTimeout(resolve, 20));
        second.resolve(
          makeDocgenPayload({ description: finishesFirst === 'bulk' ? 'new' : 'old' })
        );

        await expect(loading).resolves.toEqual({
          button: makeDocgenPayload({ description: 'new' }),
        });
        await extracting;
      }
    );
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

    it.each(['Constructor', 'Prototype'])(
      'emits and lists the payload of a component titled %s, whose id is a reserved key',
      async (title) => {
        const id = title.toLowerCase();
        const payload = makeDocgenPayload({ id, name: title });
        const service = registerDocgenService({
          getIndex: makeGetIndex([makeStoryEntry(`${id}--primary`, title)]),
          docgenProvider: async () => payload,
        });
        const emitted: Array<DocgenPayload | undefined> = [];

        const unsubscribe = service.queries.docgen.subscribe({ id }, (state) =>
          emitted.push(state.data)
        );

        await vi.waitFor(() => expect(emitted.at(-1)).toEqual(payload));
        expect(readAllComponents(service.queries.docgenForAllComponents.get())).toEqual({
          [id]: payload,
        });
        unsubscribe();
      }
    );
  });

  describe('module graph hot refresh', () => {
    let channel: SpiedTestChannel;

    beforeEach(() => {
      channel = createTestChannel();
      registerTestModuleGraphService();
    });

    // The module graph reports the changed file, and its refresh reads the index, before the story
    // index is invalidated.
    const changeButtonStoryFile = async (applyChange: () => void) => {
      const moduleGraph = getService('core/module-graph', { internal: true });
      await moduleGraph.commands._applyGraphUpdate({ bumpedStoryFiles: ['./button.stories.tsx'] });
      await new Promise((resolve) => setTimeout(resolve, 20));
      applyChange();
      channel.emitExternal(STORY_INDEX_INVALIDATED);
    };

    it('does not re-extract on registration alone', async () => {
      const provider = vi.fn<DocgenProvider>(async () => makeDocgenPayload());
      const service = registerDocgenService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        docgenProvider: provider,
      });
      await service.queries.docgen.loaded({ id: 'button' });

      const moduleGraph = getService('core/module-graph', { internal: true });
      await moduleGraph.commands._applyGraphUpdate({
        bumpedStoryFiles: ['./button.stories.tsx'],
      });

      await expect(
        vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(2), { timeout: 200 })
      ).rejects.toThrow();
    });

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
      const getIndex = makeGetIndex([buttonEntry, cardEntry]);
      const service = registerDocgenService({ getIndex, docgenProvider: provider });
      subscribeDocgenToModuleGraphChanges({ channel, getIndex, workingDir: process.cwd() });

      await service.queries.docgen.loaded({ id: 'button' });

      const moduleGraph = getService('core/module-graph', { internal: true });
      await moduleGraph.commands._applyGraphUpdate({
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
      const getIndex = makeGetIndex([buttonEntry, cardEntry]);
      const service = registerDocgenService({ getIndex, docgenProvider: provider });
      subscribeDocgenToModuleGraphChanges({ channel, getIndex, workingDir: process.cwd() });

      await service.queries.docgen.loaded({ id: 'button' });

      const moduleGraph = getService('core/module-graph', { internal: true });
      await moduleGraph.commands._applyGraphUpdate({
        bumpedStoryFiles: ['./button.stories.tsx'],
      });

      await vi.waitFor(() =>
        expect(provider.mock.calls.map(([input]) => input.entry.importPath)).toEqual([
          './button.stories.tsx',
          './button.stories.tsx',
        ])
      );
    });

    it('skips the refresh when the story index cannot be built', async () => {
      const onUnhandledRejection = vi.fn();
      process.on('unhandledRejection', onUnhandledRejection);
      const provider = vi.fn<DocgenProvider>(async () => makeDocgenPayload());
      const resolveIndex = makeGetIndex([makeStoryEntry('button--primary', 'Button')]);
      let indexBroken = false;
      const getIndex = vi.fn(() =>
        indexBroken
          ? Promise.reject(new Error('Syntax error in button.stories.tsx'))
          : resolveIndex()
      );
      const service = registerDocgenService({ getIndex, docgenProvider: provider });
      subscribeDocgenToModuleGraphChanges({ channel, getIndex, workingDir: process.cwd() });

      await service.queries.docgen.loaded({ id: 'button' });
      const callsBeforeUpdate = getIndex.mock.calls.length;
      indexBroken = true;

      const moduleGraph = getService('core/module-graph', { internal: true });
      await moduleGraph.commands._applyGraphUpdate({
        bumpedStoryFiles: ['./button.stories.tsx'],
      });

      await vi.waitFor(() => expect(getIndex.mock.calls.length).toBeGreaterThan(callsBeforeUpdate));
      await new Promise((resolve) => setTimeout(resolve, 0));
      process.off('unhandledRejection', onUnhandledRejection);
      expect(onUnhandledRejection).not.toHaveBeenCalled();
      expect(provider).toHaveBeenCalledTimes(1);
    });

    it('refreshes a component whose stories changed again after its refresh failed', async () => {
      let entries = [
        makeStoryEntry('button--primary', 'Button'),
        { ...makeStoryEntry('button--secondary', 'Button'), importPath: './more.stories.tsx' },
      ];
      const getIndex = () => makeGetIndex(entries)();
      const provider = vi.fn<DocgenProvider>(async ({ entry }) =>
        makeDocgenPayload({ path: entry.importPath })
      );
      const service = registerDocgenService({ getIndex, docgenProvider: provider });
      subscribeDocgenToModuleGraphChanges({ channel, getIndex, workingDir: process.cwd() });
      await service.commands.extractDocgen({ id: 'button' });
      expect(service.queries.docgen.get({ id: 'button' })?.path).toBe('./more.stories.tsx');
      provider.mockRejectedValueOnce(new Error('The docgen worker exited'));

      entries = [
        makeStoryEntry('button--primary', 'Button'),
        { ...makeStoryEntry('buttons--secondary', 'Buttons'), importPath: './more.stories.tsx' },
      ];
      channel.emitExternal(STORY_INDEX_INVALIDATED);
      await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(2));
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(service.queries.docgen.get({ id: 'button' })?.path).toBe('./more.stories.tsx');
      channel.emitExternal(STORY_INDEX_INVALIDATED);

      await vi.waitFor(() =>
        expect(service.queries.docgen.get({ id: 'button' })?.path).toBe('./button.stories.tsx')
      );
    });

    it('restores and keeps a component that only an attached MDX file names', async () => {
      const attachedDocs = {
        id: 'button--docs',
        name: 'Docs',
        title: 'Button',
        type: 'docs',
        importPath: './button.mdx',
        storiesImports: ['./button.stories.tsx'],
        tags: [Tag.ATTACHED_MDX, 'docs'],
      } satisfies DocsIndexEntry;
      const original = [makeStoryEntry('custom--primary', 'Custom'), attachedDocs];
      let entries: IndexEntry[] = original;
      const getIndex = () => makeGetIndex(entries)();
      const provider = vi.fn<DocgenProvider>(async () => makeDocgenPayload());
      const service = registerDocgenService({ getIndex, docgenProvider: provider });
      subscribeDocgenToModuleGraphChanges({ channel, getIndex, workingDir: process.cwd() });
      await service.commands.extractDocgen({ id: 'button' });

      channel.emitExternal(STORY_INDEX_INVALIDATED);
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(provider).toHaveBeenCalledTimes(1);

      await changeButtonStoryFile(() => {
        entries = [makeStoryEntry('custom--primary', 'Custom')];
      });
      await vi.waitFor(() => expect(service.queries.docgen.get({ id: 'button' })).toBeUndefined());
      await changeButtonStoryFile(() => {
        entries = original;
      });

      await vi.waitFor(() =>
        expect(service.queries.docgen.get({ id: 'button' })).toEqual(makeDocgenPayload())
      );
    });

    it.each([
      {
        change: 'its title was renamed',
        nextEntries: [
          { ...makeStoryEntry('buttons--primary', 'Buttons'), importPath: './button.stories.tsx' },
          makeStoryEntry('card--primary', 'Card'),
        ],
      },
      {
        change: 'its story file was deleted',
        nextEntries: [makeStoryEntry('card--primary', 'Card')],
      },
      {
        change: 'only an unattached MDX file keeps its title',
        nextEntries: [
          {
            id: 'button--docs',
            name: 'Docs',
            title: 'Button',
            type: 'docs',
            importPath: './button.mdx',
            storiesImports: [],
            tags: [Tag.UNATTACHED_MDX, 'docs'],
          } satisfies DocsIndexEntry,
          makeStoryEntry('card--primary', 'Card'),
        ],
      },
    ])('drops the payload of an extracted component when $change', async ({ nextEntries }) => {
      let entries = [
        makeStoryEntry('button--primary', 'Button'),
        makeStoryEntry('card--primary', 'Card'),
      ];
      const getIndex = () => makeGetIndex(entries)();
      const service = registerDocgenService({
        getIndex,
        docgenProvider: async ({ entry }) => makeDocgenPayload({ id: entry.id.split('--')[0] }),
      });
      subscribeDocgenToModuleGraphChanges({ channel, getIndex, workingDir: process.cwd() });
      const emitted: Array<DocgenPayload | undefined> = [];
      const unsubscribe = service.queries.docgen.subscribe({ id: 'button' }, (state) =>
        emitted.push(state.data)
      );
      await vi.waitFor(() => expect(emitted.at(-1)).toEqual(makeDocgenPayload({ id: 'button' })));

      await changeButtonStoryFile(() => {
        entries = nextEntries;
      });

      await vi.waitFor(() => expect(emitted.at(-1)).toBeUndefined());
      expect(service.queries.docgenForAllComponents.get()).not.toHaveProperty('button');
      unsubscribe();
    });
  });

  describe('static build', () => {
    it('announces every component entry before a static build extracts them', async () => {
      const button = makeStoryEntry('button--primary', 'Button');
      const card = makeStoryEntry('card--default', 'Card');
      const calls: string[] = [];
      registerDocgenService({
        getIndex: makeGetIndex([button, card]),
        docgenProvider: async ({ entry }) => {
          calls.push(`extract ${entry.id}`);
          return makeDocgenPayload({ path: entry.importPath });
        },
        prepareDocgen: (entries) => calls.push(`prepare ${entries.map(({ id }) => id).join(',')}`),
      });

      await buildStaticFiles();

      expect(calls).toEqual([
        'prepare button--primary,card--default',
        'extract button--primary',
        'extract card--default',
      ]);
    });

    it('writes the static snapshot when the dev runtime extracts the same component meanwhile', async () => {
      const staticExtraction = Promise.withResolvers<DocgenPayload>();
      const provider = vi
        .fn<DocgenProvider>(async () => makeDocgenPayload())
        .mockReturnValueOnce(staticExtraction.promise);
      const service = registerDocgenService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        docgenProvider: provider,
      });

      const building = buildStaticFiles();
      await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(1));
      await service.commands.extractDocgen({ id: 'button' });
      staticExtraction.resolve(makeDocgenPayload());
      const store = await building;

      expect(store['core/docgen/button.json']).toEqual({
        components: { button: makeDocgenPayload() },
      });
    });

    it('writes the payload of a component titled Constructor where its manifest ref points', async () => {
      const payload = makeDocgenPayload({ id: 'constructor', name: 'Constructor' });
      registerDocgenService({
        getIndex: makeGetIndex([makeStoryEntry('constructor--primary', 'Constructor')]),
        docgenProvider: async () => payload,
      });

      const store = await buildStaticFiles();

      const { path, pointer } = parseManifestRef(docgenManifestRef('constructor'));
      expect(path).toBe('./services/core/docgen/constructor.json');
      expect(
        pointer.reduce<unknown>(
          (node, segment) => (node as Record<string, unknown>)[segment],
          store['core/docgen/constructor.json']
        )
      ).toEqual(payload);
    });

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
