import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import { STORY_INDEX_INVALIDATED } from 'storybook/internal/core-events';

import { getChannel } from '../../../../channels/channel-slot.ts';
import { createTestChannel, type SpiedTestChannel } from '../../../../channels/test-channel.ts';
import type { IndexEntry, StoryIndex } from '../../../../types/modules/indexer.ts';
import { clearRegistry, getService } from '../../server.ts';
import { SERVICE_ENTRY, type EntryPayload } from '../../service-channel.ts';
import { serviceRegistryApi } from '../../service-registry.ts';
import { createServiceRuntime } from '../../service-runtime.ts';
import { createReconciler } from '../../service-sync.ts';
import { readAllComponents } from '../component-state-key.ts';
import { registerTestModuleGraphService } from '../module-graph/module-graph.test-helpers.ts';
import { storyDocsServiceDef } from './definition.ts';
import { registerStoryDocsService, subscribeStoryDocsToModuleGraphChanges } from './server.ts';
import { type SnippetTemplate, registerPrintHole } from '../../../../docs-tools/snippetTemplate.ts';
import type { StoryDocsPayload, StoryDocsProvider } from './types.ts';

// `<Button label="…" />` with its label in a hole.
const buttonTemplate = (
  text = 'label="Hi"',
  name = 'label'
): SnippetTemplate<{ kind: 'attr'; name: string }> => [
  '<Button ',
  { kind: 'attr', name, arg: 'label', text },
  ' />',
];
const vegaTemplate: SnippetTemplate = ['<Vega', { kind: 'attrs', spread: true, text: '' }, ' />'];

afterEach(() => {
  clearRegistry();
  vi.unstubAllGlobals();
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
    const provider = vi.fn<StoryDocsProvider['extract']>(async () => payload);

    const service = registerStoryDocsService({
      getIndex: makeGetIndex([entry]),
      storyDocsProvider: provider,
    });

    await expect(service.commands.extractStoryDocs({ id: 'button' })).resolves.toEqual(payload);
    expect(service.queries.storyDocs.get({ id: 'button' })).toEqual(payload);
    expect(provider).toHaveBeenCalledWith({ entry });
  });

  it('extracts a component once for the calls that arrive while its extraction runs', async () => {
    const entry = makeStoryEntry('button--primary', 'Button');
    const payload = makeStoryDocsPayload();
    let finish = (_: StoryDocsPayload) => {};
    const provider = vi.fn<StoryDocsProvider['extract']>(
      () => new Promise<StoryDocsPayload>((resolve) => (finish = resolve))
    );
    const service = registerStoryDocsService({
      getIndex: makeGetIndex([entry]),
      storyDocsProvider: provider,
    });

    const first = service.commands.extractStoryDocs({ id: 'button' });
    const second = service.commands.extractStoryDocs({ id: 'button' });
    await vi.waitFor(() => expect(provider).toHaveBeenCalled());
    finish(payload);

    await expect(Promise.all([first, second])).resolves.toEqual([payload, payload]);
    expect(provider).toHaveBeenCalledOnce();
  });

  it('fills a story template with the given args through the registered hole printer', async () => {
    vi.stubGlobal('FEATURES', { docgenServer: true, experimentalLiveServerSnippets: true });
    vi.stubGlobal(Symbol.for('storybook/docs-tools/print-hole'), undefined);
    registerPrintHole((_, value) => `label="${String(value)}"`);
    const service = registerStoryDocsService({
      getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
      storyDocsProvider: async () =>
        makeStoryDocsPayload({
          stories: {
            'button--primary': {
              id: 'button--primary',
              name: 'Primary',
              snippet: '<Button label="Hi" />',
              template: buttonTemplate(),
            },
          },
        }),
      liveSnippets: true,
    });

    await expect(
      service.queries.liveSnippet.loaded({
        storyId: 'button--primary',
        args: { label: 'Go' },
        initialArgs: { label: 'Hi' },
      })
    ).resolves.toEqual({ snippet: '<Button label="Go" />' });
    // Without `initialArgs`, as an agent calls it, only the given args fill.
    expect(
      service.queries.liveSnippet.get({ storyId: 'button--primary', args: { label: 'Go' } })
    ).toEqual({ snippet: '<Button label="Go" />' });
    expect(service.queries.liveSnippet.get({ storyId: 'button--primary', args: {} })).toEqual({
      snippet: '<Button label="Hi" />',
    });
  });

  it('keeps a template only while it prints the snippet and has the shape of one', async () => {
    const entry = makeStoryEntry('button--primary', 'Button');
    const story = (id: string, snippet: string, template: unknown) => ({
      id: `button--${id}`,
      name: 'Primary',
      snippet,
      template: template as SnippetTemplate,
    });
    const stories = [
      story('kept', '<Button label="Hi" />', buttonTemplate()),
      story('brackets', '<Button label="⟦x⟧" />', ['<Button label="⟦x⟧" />']),
      story('other-snippet', '<Button label="Hi" />  ', [...buttonTemplate('label="Hey"'), '  ']),
      story('string', '<Button label="Hi" />', '<Button ⟦attr label label⟫label="Hi"⟧ />'),
      story('no-arg', '<Button label="Hi" />', [
        '<Button ',
        { kind: 'attr', text: 'label="Hi"' },
        ' />',
      ]),
    ];
    const templatesWith = async (liveSnippets: boolean) => {
      clearRegistry();
      const service = registerStoryDocsService({
        getIndex: makeGetIndex([entry]),
        storyDocsProvider: async () =>
          makeStoryDocsPayload({ stories: Object.fromEntries(stories.map((s) => [s.id, s])) }),
        liveSnippets,
      });
      const payload = await service.commands.extractStoryDocs({ id: 'button' });
      return Object.values(payload!.stories).map((doc) => doc.template);
    };

    expect(await templatesWith(true)).toEqual([
      stories[0]!.template,
      stories[1]!.template,
      undefined,
      undefined,
      undefined,
    ]);
    // Without live snippets, agents and the components manifest read no templates.
    expect(await templatesWith(false)).toEqual(stories.map(() => undefined));
  });

  it('updates a subscription to a template when only the template changes', async () => {
    let name = 'label';
    const service = registerStoryDocsService({
      getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
      storyDocsProvider: async () =>
        makeStoryDocsPayload({
          stories: {
            'button--primary': {
              id: 'button--primary',
              name: 'Primary',
              snippet: '<Button label="Hi" />',
              template: buttonTemplate('label="Hi"', name),
            },
          },
        }),
      liveSnippets: true,
    });
    await service.commands.extractStoryDocs({ id: 'button' });
    const selected: unknown[] = [];
    const unsubscribe = service.queries.storyDocs.subscribe(
      { id: 'button' },
      (payload) => payload?.stories['button--primary']?.template,
      (state) => selected.push(state.data)
    );

    // A server update that changes the template but not the snippet.
    name = 'title';
    await service.commands.extractStoryDocs({ id: 'button' });
    unsubscribe();

    expect(selected.at(-1)).toEqual(buttonTemplate('label="Hi"', 'title'));
  });

  describe('storyDocs query', () => {
    it('emits a payload that is extracted after the subscription starts', async () => {
      const payload = makeStoryDocsPayload();
      const extracted = Promise.withResolvers<StoryDocsPayload>();
      const service = registerStoryDocsService({
        getIndex: makeGetIndex([makeStoryEntry('button--primary', 'Button')]),
        storyDocsProvider: () => extracted.promise,
      });
      const emitted: Array<StoryDocsPayload | undefined> = [];

      const unsubscribe = service.queries.storyDocs.subscribe({ id: 'button' }, (state) =>
        emitted.push(state.data)
      );
      extracted.resolve(payload);

      await vi.waitFor(() => expect(emitted.at(-1)).toEqual(payload));
      unsubscribe();
    });

    it('answers undefined for a prototype member such as constructor', () => {
      const service = registerStoryDocsService({
        getIndex: makeGetIndex([]),
        storyDocsProvider: async () => undefined,
      });

      expect(service.queries.storyDocs.get({ id: 'constructor' })).toBeUndefined();
    });

    it.each(['Constructor', 'Prototype'])(
      'emits and lists the payload of a component titled %s, whose id is a reserved key',
      async (title) => {
        const id = title.toLowerCase();
        const payload = makeStoryDocsPayload({ id, name: title });
        const service = registerStoryDocsService({
          getIndex: makeGetIndex([makeStoryEntry(`${id}--primary`, title)]),
          storyDocsProvider: async () => payload,
        });
        const emitted: Array<StoryDocsPayload | undefined> = [];

        const unsubscribe = service.queries.storyDocs.subscribe({ id }, (state) =>
          emitted.push(state.data)
        );

        await vi.waitFor(() => expect(emitted.at(-1)).toEqual(payload));
        expect(readAllComponents(service.queries.storyDocsForAllComponents.get())).toEqual({
          [id]: payload,
        });
        unsubscribe();
      }
    );

    it('gives a peer the payload of a component titled Constructor', async () => {
      const emit = vi.spyOn(getChannel()!, 'emit');
      onTestFinished(() => emit.mockRestore());
      const payload = makeStoryDocsPayload({ id: 'constructor', name: 'Constructor' });
      const service = registerStoryDocsService({
        getIndex: makeGetIndex([makeStoryEntry('constructor--primary', 'Constructor')]),
        storyDocsProvider: async () => payload,
      });
      await service.commands.extractStoryDocs({ id: 'constructor' });

      const peer = createServiceRuntime(storyDocsServiceDef, { registryApi: serviceRegistryApi });
      const reconciler = createReconciler({
        serviceId: storyDocsServiceDef.id,
        setState: (mutate) => peer.applyLocal((state) => mutate(state)),
      });
      for (const [event, entry] of emit.mock.calls) {
        if (event === SERVICE_ENTRY) {
          reconciler.tryPlaceEntry(entry as EntryPayload);
        }
      }

      expect(peer.queries.storyDocs.get({ id: 'constructor' })).toEqual(payload);
    });
  });

  describe('a component with several story files', () => {
    const chart = './chart.stories.tsx';
    const ranges = './ranges.stories.tsx';
    const entries = [
      { ...makeStoryEntry('vega--line', 'Vega'), importPath: chart },
      { ...makeStoryEntry('vega--heatmap', 'Vega'), importPath: ranges },
      { ...makeStoryEntry('vega--bar', 'Vega'), importPath: chart },
    ];

    const extractFile: StoryDocsProvider['extract'] = async ({ entry }) => ({
      id: 'vega',
      name: 'Vega',
      path: entry.importPath,
      import: `import { Vega } from '${entry.importPath}';`,
      stories: Object.fromEntries(
        entries
          .filter((story) => story.importPath === entry.importPath)
          .map((story) => [
            story.id,
            { id: story.id, name: story.name, snippet: '<Vega />', template: vegaTemplate },
          ])
      ),
    });

    it('extracts each file once and returns their stories in index order', async () => {
      const provider = vi.fn(extractFile);
      const service = registerStoryDocsService({
        getIndex: makeGetIndex(entries),
        storyDocsProvider: provider,
      });

      const payload = await service.commands.extractStoryDocs({ id: 'vega' });

      expect(provider.mock.calls.map(([input]) => input.entry.importPath).sort()).toEqual([
        chart,
        ranges,
      ]);
      expect(Object.keys(payload!.stories)).toEqual(['vega--line', 'vega--heatmap', 'vega--bar']);
      expect(payload).toMatchObject({ id: 'vega', name: 'Vega', path: chart });
    });

    it('gives every snippet and template the import block of its own file', async () => {
      const service = registerStoryDocsService({
        getIndex: makeGetIndex(entries),
        storyDocsProvider: extractFile,
        liveSnippets: true,
      });

      const payload = await service.commands.extractStoryDocs({ id: 'vega' });

      expect(payload).not.toHaveProperty('import');
      expect(payload!.stories['vega--bar']!.snippet).toBe(
        `import { Vega } from '${chart}';\n\n<Vega />`
      );
      expect(payload!.stories['vega--heatmap']!.snippet).toBe(
        `import { Vega } from '${ranges}';\n\n<Vega />`
      );
      expect(payload!.stories['vega--heatmap']!.template).toEqual([
        `import { Vega } from '${ranges}';\n\n<Vega`,
        ...vegaTemplate.slice(1),
      ]);
    });

    it('reports the error of a file that fails on the stories of that file', async () => {
      const service = registerStoryDocsService({
        getIndex: makeGetIndex(entries),
        storyDocsProvider: async (input) => {
          if (input.entry.importPath === ranges) {
            throw new SyntaxError('Unexpected token');
          }
          return extractFile(input);
        },
      });

      const payload = await service.commands.extractStoryDocs({ id: 'vega' });

      expect(payload!.stories['vega--heatmap']).toEqual({
        id: 'vega--heatmap',
        name: 'heatmap',
        error: { name: 'SyntaxError', message: 'Unexpected token' },
      });
      expect(payload!.stories['vega--bar']!.snippet).toBeDefined();
      expect(payload!.stories['vega--line']!.snippet).toBeDefined();
    });

    it('leaves out the stories of a file the provider returns nothing for', async () => {
      const service = registerStoryDocsService({
        getIndex: makeGetIndex(entries),
        storyDocsProvider: async (input) =>
          input.entry.importPath === ranges ? undefined : extractFile(input),
      });

      const payload = await service.commands.extractStoryDocs({ id: 'vega' });

      expect(Object.keys(payload!.stories)).toEqual(['vega--line', 'vega--bar']);
    });

    it('fails the component when the file that identifies it fails', async () => {
      const service = registerStoryDocsService({
        getIndex: makeGetIndex(entries),
        storyDocsProvider: async (input) => {
          if (input.entry.importPath === chart) {
            throw new SyntaxError('Unexpected token');
          }
          return extractFile(input);
        },
      });

      await expect(service.commands.extractStoryDocs({ id: 'vega' })).rejects.toThrow(
        'Unexpected token'
      );
    });
  });

  it('extracts a component with one story file in a single provider call', async () => {
    const entries = [
      makeStoryEntry('button--primary', 'Button'),
      makeStoryEntry('button--ghost', 'Button'),
    ];
    const payload = makeStoryDocsPayload({ import: "import { Button } from './button';" });
    const provider = vi.fn<StoryDocsProvider['extract']>(async () => payload);
    const service = registerStoryDocsService({
      getIndex: makeGetIndex(entries),
      storyDocsProvider: provider,
    });

    await expect(service.commands.extractStoryDocs({ id: 'button' })).resolves.toEqual(payload);
    expect(provider).toHaveBeenCalledTimes(1);
  });

  describe('module graph hot refresh', () => {
    let channel: SpiedTestChannel;

    beforeEach(() => {
      channel = createTestChannel();
      registerTestModuleGraphService();
    });

    // The module graph reports the changed file, and its refresh reads the index, before the story
    // index is invalidated.
    const changeButtonStoryFile = async (
      applyChange: () => void,
      storyFile = './button.stories.tsx'
    ) => {
      const moduleGraph = getService('core/module-graph', { internal: true });
      await moduleGraph.commands._applyGraphUpdate({ bumpedStoryFiles: [storyFile] });
      await new Promise((resolve) => setTimeout(resolve, 20));
      applyChange();
      channel.emitExternal(STORY_INDEX_INVALIDATED);
    };

    it('re-extracts a component when any of its story files changes', async () => {
      const entries = [
        { ...makeStoryEntry('vega--bar', 'Vega'), importPath: './chart.stories.tsx' },
        { ...makeStoryEntry('vega--heatmap', 'Vega'), importPath: './ranges.stories.tsx' },
      ];
      const provider = vi.fn<StoryDocsProvider['extract']>(async () => makeStoryDocsPayload());
      const getIndex = makeGetIndex(entries);
      const service = registerStoryDocsService({ getIndex, storyDocsProvider: provider });
      subscribeStoryDocsToModuleGraphChanges({ channel, getIndex, workingDir: process.cwd() });

      await service.queries.storyDocs.loaded({ id: 'vega' });
      expect(provider).toHaveBeenCalledTimes(2);

      const moduleGraph = getService('core/module-graph', { internal: true });
      await moduleGraph.commands._applyGraphUpdate({
        bumpedStoryFiles: ['./chart.stories.tsx'],
      });

      await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(4));
    });

    // Snippets come from the story file's own source. Already-extracted components must re-extract
    // when their story file changes so snippets stay fresh after the edit.
    it('re-extracts already-extracted components when their story file changes', async () => {
      const entry = makeStoryEntry('button--primary', 'Button');
      const provider = vi.fn<StoryDocsProvider['extract']>(async () => makeStoryDocsPayload());
      const getIndex = makeGetIndex([entry]);
      const service = registerStoryDocsService({ getIndex, storyDocsProvider: provider });
      subscribeStoryDocsToModuleGraphChanges({ channel, getIndex, workingDir: process.cwd() });

      await service.queries.storyDocs.loaded({ id: 'button' });
      expect(provider).toHaveBeenCalledTimes(1);

      const moduleGraph = getService('core/module-graph', { internal: true });
      await moduleGraph.commands._applyGraphUpdate({
        bumpedStoryFiles: ['./button.stories.tsx'],
      });

      await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(2));
    });

    it('re-extracts a component whose story file changes while it is being extracted', async () => {
      const entry = makeStoryEntry('button--primary', 'Button');
      const provider = vi.fn<StoryDocsProvider['extract']>(async () => makeStoryDocsPayload());
      const getIndex = makeGetIndex([entry]);
      const service = registerStoryDocsService({ getIndex, storyDocsProvider: provider });
      subscribeStoryDocsToModuleGraphChanges({ getIndex, workingDir: process.cwd() });
      await service.queries.storyDocs.loaded({ id: 'button' });
      provider.mockImplementationOnce(() => new Promise(() => {}));
      void service.commands.extractStoryDocs({ id: 'button' });
      await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(2));

      const moduleGraph = getService('core/module-graph', { internal: true });
      await moduleGraph.commands._applyGraphUpdate({
        bumpedStoryFiles: ['./button.stories.tsx'],
      });

      await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(3));
    });

    it('extracts again for a call after a story file changes during its first extraction', async () => {
      const entry = makeStoryEntry('button--primary', 'Button');
      let finishFirst = (_: StoryDocsPayload) => {};
      const provider = vi
        .fn<StoryDocsProvider['extract']>()
        .mockImplementationOnce(() => new Promise((resolve) => (finishFirst = resolve)))
        .mockImplementation(async () => makeStoryDocsPayload({ name: 'New' }));
      const getIndex = makeGetIndex([entry]);
      const service = registerStoryDocsService({ getIndex, storyDocsProvider: provider });
      subscribeStoryDocsToModuleGraphChanges({ getIndex, workingDir: process.cwd() });
      const firstLoad = service.commands.extractStoryDocs({ id: 'button' });
      await vi.waitFor(() => expect(provider).toHaveBeenCalledOnce());

      const moduleGraph = getService('core/module-graph', { internal: true });
      await moduleGraph.commands._applyGraphUpdate({
        bumpedStoryFiles: ['./button.stories.tsx'],
      });
      const afterChange = service.commands.extractStoryDocs({ id: 'button' });
      finishFirst(makeStoryDocsPayload({ name: 'Old' }));
      await firstLoad;

      await expect(afterChange).resolves.toMatchObject({ name: 'New' });
      expect(service.queries.storyDocs.get({ id: 'button' })?.name).toBe('New');
    });

    it('keeps the refreshed story docs when the extraction a file change replaced finishes later', async () => {
      const entry = makeStoryEntry('button--primary', 'Button');
      let finishReplaced = (_: StoryDocsPayload) => {};
      const provider = vi
        .fn<StoryDocsProvider['extract']>()
        .mockImplementationOnce(async () => makeStoryDocsPayload({ name: 'Start' }))
        .mockImplementationOnce(() => new Promise((resolve) => (finishReplaced = resolve)))
        .mockImplementation(async () => makeStoryDocsPayload({ name: 'New' }));
      const getIndex = makeGetIndex([entry]);
      const service = registerStoryDocsService({ getIndex, storyDocsProvider: provider });
      subscribeStoryDocsToModuleGraphChanges({ getIndex, workingDir: process.cwd() });
      await service.queries.storyDocs.loaded({ id: 'button' });
      const replaced = service.commands.extractStoryDocs({ id: 'button' });
      await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(2));

      const moduleGraph = getService('core/module-graph', { internal: true });
      await moduleGraph.commands._applyGraphUpdate({
        bumpedStoryFiles: ['./button.stories.tsx'],
      });
      await vi.waitFor(() =>
        expect(service.queries.storyDocs.get({ id: 'button' })?.name).toBe('New')
      );
      finishReplaced(makeStoryDocsPayload({ name: 'Old' }));
      await replaced;

      expect(service.queries.storyDocs.get({ id: 'button' })?.name).toBe('New');
    });

    it('re-extracts a component whose story file changes while it is being extracted, after a repeated registration', async () => {
      const entry = makeStoryEntry('button--primary', 'Button');
      const provider = vi.fn<StoryDocsProvider['extract']>(async () => makeStoryDocsPayload());
      const getIndex = makeGetIndex([entry]);
      const service = registerStoryDocsService({ getIndex, storyDocsProvider: provider });
      registerStoryDocsService({ getIndex, storyDocsProvider: provider });
      subscribeStoryDocsToModuleGraphChanges({ getIndex, workingDir: process.cwd() });
      await service.queries.storyDocs.loaded({ id: 'button' });
      provider.mockImplementationOnce(() => new Promise(() => {}));
      void service.commands.extractStoryDocs({ id: 'button' });
      await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(2));

      const moduleGraph = getService('core/module-graph', { internal: true });
      await moduleGraph.commands._applyGraphUpdate({
        bumpedStoryFiles: ['./button.stories.tsx'],
      });

      await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(3));
    });

    it('does not re-extract components that were never extracted', async () => {
      const provider = vi.fn<StoryDocsProvider['extract']>(async () => makeStoryDocsPayload());
      const getIndex = makeGetIndex([makeStoryEntry('button--primary', 'Button')]);
      registerStoryDocsService({ getIndex, storyDocsProvider: provider });
      subscribeStoryDocsToModuleGraphChanges({ channel, getIndex, workingDir: process.cwd() });

      const moduleGraph = getService('core/module-graph', { internal: true });
      await moduleGraph.commands._applyGraphUpdate({
        bumpedStoryFiles: ['./button.stories.tsx'],
      });

      // Nothing was extracted, so the story-file update has no component to refresh.
      await expect(vi.waitFor(() => expect(provider).toHaveBeenCalled())).rejects.toThrow();
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
    ])('drops the payload of an extracted component when $change', async ({ nextEntries }) => {
      let entries = [
        makeStoryEntry('button--primary', 'Button'),
        makeStoryEntry('card--primary', 'Card'),
      ];
      const getIndex = () => makeGetIndex(entries)();
      const service = registerStoryDocsService({
        getIndex,
        storyDocsProvider: async ({ entry }) =>
          makeStoryDocsPayload({ id: entry.id.split('--')[0] }),
      });
      subscribeStoryDocsToModuleGraphChanges({ channel, getIndex, workingDir: process.cwd() });
      const emitted: Array<StoryDocsPayload | undefined> = [];
      const unsubscribe = service.queries.storyDocs.subscribe({ id: 'button' }, (state) =>
        emitted.push(state.data)
      );
      await vi.waitFor(() =>
        expect(emitted.at(-1)).toEqual(makeStoryDocsPayload({ id: 'button' }))
      );

      await changeButtonStoryFile(() => {
        entries = nextEntries;
      });

      await vi.waitFor(() => expect(emitted.at(-1)).toBeUndefined());
      expect(service.queries.storyDocsForAllComponents.get()).not.toHaveProperty('button');
      unsubscribe();
    });

    it.each([{ stored: false }, { stored: true }])(
      'drops the payload of a component whose story file is deleted while it is extracted (stored before: $stored)',
      async ({ stored }) => {
        let entries = [
          makeStoryEntry('button--primary', 'Button'),
          makeStoryEntry('card--primary', 'Card'),
        ];
        const getIndex = () => makeGetIndex(entries)();
        const extraction = Promise.withResolvers<StoryDocsPayload>();
        const provider = vi.fn<StoryDocsProvider>(() => extraction.promise);
        const service = registerStoryDocsService({ getIndex, storyDocsProvider: provider });
        subscribeStoryDocsToModuleGraphChanges({ channel, getIndex, workingDir: process.cwd() });
        if (stored) {
          provider.mockResolvedValueOnce(makeStoryDocsPayload());
          await service.commands.extractStoryDocs({ id: 'button' });
        }
        const extracting = service.commands.extractStoryDocs({ id: 'button' }).catch(() => {});
        await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(stored ? 2 : 1));

        await changeButtonStoryFile(() => {
          entries = [makeStoryEntry('card--primary', 'Card')];
        });
        extraction.resolve(makeStoryDocsPayload());
        await extracting;

        expect(service.queries.storyDocs.get({ id: 'button' })).toBeUndefined();
      }
    );

    it('drops the payload of a component whose story file is deleted while every component is extracted', async () => {
      let entries = [
        makeStoryEntry('button--primary', 'Button'),
        makeStoryEntry('card--primary', 'Card'),
      ];
      const getIndex = () => makeGetIndex(entries)();
      const buttonExtraction = Promise.withResolvers<StoryDocsPayload>();
      const provider = vi.fn<StoryDocsProvider>(({ entry }) =>
        entry.title === 'Button'
          ? buttonExtraction.promise
          : Promise.resolve(makeStoryDocsPayload({ id: 'card' }))
      );
      const service = registerStoryDocsService({ getIndex, storyDocsProvider: provider });
      subscribeStoryDocsToModuleGraphChanges({ channel, getIndex, workingDir: process.cwd() });
      const extracting = service.commands.extractAllStoryDocs(undefined);
      await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(2));

      await changeButtonStoryFile(() => {
        entries = [makeStoryEntry('card--primary', 'Card')];
      });
      buttonExtraction.resolve(makeStoryDocsPayload());
      await extracting;

      expect(Object.keys(service.queries.storyDocsForAllComponents.get())).toEqual(['card']);
    });

    it('drops the stories of a file whose title was renamed from a component that keeps another file', async () => {
      let entries = [
        makeStoryEntry('button--primary', 'Button'),
        { ...makeStoryEntry('button--secondary', 'Button'), importPath: './more.stories.tsx' },
      ];
      const getIndex = () => makeGetIndex(entries)();
      const service = registerStoryDocsService({
        getIndex,
        storyDocsProvider: async ({ entry }) =>
          makeStoryDocsPayload({
            stories: Object.fromEntries(
              entries
                .filter((story) => story.importPath === entry.importPath)
                .map((story) => [story.id, { id: story.id, name: story.name }])
            ),
          }),
      });
      subscribeStoryDocsToModuleGraphChanges({ channel, getIndex, workingDir: process.cwd() });
      await service.commands.extractStoryDocs({ id: 'button' });

      await changeButtonStoryFile(() => {
        entries = [
          makeStoryEntry('button--primary', 'Button'),
          { ...makeStoryEntry('buttons--secondary', 'Buttons'), importPath: './more.stories.tsx' },
        ];
      }, './more.stories.tsx');

      await vi.waitFor(() =>
        expect(Object.keys(service.queries.storyDocs.get({ id: 'button' })!.stories)).toEqual([
          'button--primary',
        ])
      );
    });

    it('keeps the newer extraction when an older one of the same component finishes later', async () => {
      let entries = [
        makeStoryEntry('button--primary', 'Button'),
        { ...makeStoryEntry('button--secondary', 'Button'), importPath: './more.stories.tsx' },
      ];
      const getIndex = () => makeGetIndex(entries)();
      const storiesOf = (importPath: string) =>
        Object.fromEntries(
          entries
            .filter((story) => story.importPath === importPath)
            .map((story) => [story.id, { id: story.id, name: story.name }])
        );
      let slowFile: PromiseWithResolvers<StoryDocsPayload> | undefined;
      const service = registerStoryDocsService({
        getIndex,
        storyDocsProvider: async ({ entry }) => {
          const payload = makeStoryDocsPayload({ stories: storiesOf(entry.importPath) });
          if (slowFile && entry.importPath === './more.stories.tsx') {
            const pending = slowFile;
            slowFile = undefined;
            return pending.promise.then(() => payload);
          }
          return payload;
        },
      });
      subscribeStoryDocsToModuleGraphChanges({ channel, getIndex, workingDir: process.cwd() });
      await service.commands.extractStoryDocs({ id: 'button' });
      const olderExtraction = Promise.withResolvers<StoryDocsPayload>();
      slowFile = olderExtraction;

      await changeButtonStoryFile(() => {
        entries = [
          makeStoryEntry('button--primary', 'Button'),
          { ...makeStoryEntry('buttons--secondary', 'Buttons'), importPath: './more.stories.tsx' },
        ];
      }, './more.stories.tsx');
      await vi.waitFor(() =>
        expect(Object.keys(service.queries.storyDocs.get({ id: 'button' })!.stories)).toEqual([
          'button--primary',
        ])
      );
      olderExtraction.resolve(makeStoryDocsPayload());
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(Object.keys(service.queries.storyDocs.get({ id: 'button' })!.stories)).toEqual([
        'button--primary',
      ]);
    });

    it('retries a restore whose extraction failed on the next index change', async () => {
      const original = [makeStoryEntry('button--primary', 'Button')];
      let entries = original;
      const getIndex = () => makeGetIndex(entries)();
      const provider = vi.fn<StoryDocsProvider>(async () => makeStoryDocsPayload());
      const service = registerStoryDocsService({ getIndex, storyDocsProvider: provider });
      subscribeStoryDocsToModuleGraphChanges({ channel, getIndex, workingDir: process.cwd() });
      const emitted: Array<StoryDocsPayload | undefined> = [];
      const unsubscribe = service.queries.storyDocs.subscribe({ id: 'button' }, (state) =>
        emitted.push(state.data)
      );
      await vi.waitFor(() => expect(emitted.at(-1)).toEqual(makeStoryDocsPayload()));
      await changeButtonStoryFile(() => {
        entries = [];
      });
      await vi.waitFor(() => expect(emitted.at(-1)).toBeUndefined());

      provider.mockRejectedValueOnce(new Error('The docgen worker exited'));
      await changeButtonStoryFile(() => {
        entries = original;
      });
      await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(2));
      expect(emitted.at(-1)).toBeUndefined();
      await changeButtonStoryFile(() => {});

      await vi.waitFor(() => expect(emitted.at(-1)).toEqual(makeStoryDocsPayload()));
      unsubscribe();
    });

    it('gives an open subscriber the payload when a file deleted during its first extraction is restored', async () => {
      const original = [makeStoryEntry('button--primary', 'Button')];
      let entries = original;
      const getIndex = () => makeGetIndex(entries)();
      const firstExtraction = Promise.withResolvers<StoryDocsPayload>();
      const provider = vi
        .fn<StoryDocsProvider>(async () => makeStoryDocsPayload())
        .mockReturnValueOnce(firstExtraction.promise);
      const service = registerStoryDocsService({ getIndex, storyDocsProvider: provider });
      subscribeStoryDocsToModuleGraphChanges({ channel, getIndex, workingDir: process.cwd() });
      const emitted: Array<StoryDocsPayload | undefined> = [];
      const unsubscribe = service.queries.storyDocs.subscribe({ id: 'button' }, (state) =>
        emitted.push(state.data)
      );
      await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(1));

      await changeButtonStoryFile(() => {
        entries = [];
      });
      firstExtraction.resolve(makeStoryDocsPayload());
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(service.queries.storyDocs.get({ id: 'button' })).toBeUndefined();
      await changeButtonStoryFile(() => {
        entries = original;
      });

      await vi.waitFor(() => expect(emitted.at(-1)).toEqual(makeStoryDocsPayload()));
      unsubscribe();
    });

    it.each([
      {
        change: 'a renamed title is reverted',
        changedEntries: [
          { ...makeStoryEntry('buttons--primary', 'Buttons'), importPath: './button.stories.tsx' },
        ],
      },
      { change: 'a deleted story file is restored', changedEntries: [] },
    ])('gives an open subscriber the payload again when $change', async ({ changedEntries }) => {
      const original = [makeStoryEntry('button--primary', 'Button')];
      let entries = original;
      const getIndex = () => makeGetIndex(entries)();
      const service = registerStoryDocsService({
        getIndex,
        storyDocsProvider: async ({ entry }) =>
          makeStoryDocsPayload({ id: entry.id.split('--')[0] }),
      });
      subscribeStoryDocsToModuleGraphChanges({ channel, getIndex, workingDir: process.cwd() });
      const emitted: Array<StoryDocsPayload | undefined> = [];
      const unsubscribe = service.queries.storyDocs.subscribe({ id: 'button' }, (state) =>
        emitted.push(state.data)
      );
      await vi.waitFor(() =>
        expect(emitted.at(-1)).toEqual(makeStoryDocsPayload({ id: 'button' }))
      );

      await changeButtonStoryFile(() => {
        entries = changedEntries;
      });
      await vi.waitFor(() => expect(emitted.at(-1)).toBeUndefined());
      await changeButtonStoryFile(() => {
        entries = original;
      });

      await vi.waitFor(() =>
        expect(emitted.at(-1)).toEqual(makeStoryDocsPayload({ id: 'button' }))
      );
      unsubscribe();
    });
  });

  it('keeps a component whose custom id starts with ~ apart from a component titled Constructor', async () => {
    const service = registerStoryDocsService({
      getIndex: makeGetIndex([
        makeStoryEntry('constructor--primary', 'Constructor'),
        // A story can set its own id with `parameters: { __id }`, which is not sanitized.
        { ...makeStoryEntry('~constructor--primary', 'Other'), importPath: './other.stories.tsx' },
      ]),
      storyDocsProvider: async ({ entry }) => makeStoryDocsPayload({ id: entry.id.split('--')[0] }),
    });

    await service.commands.extractAllStoryDocs(undefined);

    expect(service.queries.storyDocs.get({ id: 'constructor' })).toEqual(
      makeStoryDocsPayload({ id: 'constructor' })
    );
    expect(readAllComponents(service.queries.storyDocsForAllComponents.get())).toEqual({
      constructor: makeStoryDocsPayload({ id: 'constructor' }),
      '~constructor': makeStoryDocsPayload({ id: '~constructor' }),
    });
  });
});
