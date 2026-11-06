import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IndexEntry, StoryIndex } from '../../../../types/modules/indexer.ts';
import { clearRegistry, getService } from '../../server.ts';
import { registerTestModuleGraphService } from '../module-graph/module-graph.test-helpers.ts';
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
  it('updates a subscription that started before the payload was stored', async () => {
    const entry = makeStoryEntry('button--primary', 'Button');
    const payload = makeStoryDocsPayload();
    const service = registerStoryDocsService({
      getIndex: makeGetIndex([entry]),
      storyDocsProvider: async () => payload,
    });
    const selected: unknown[] = [];
    const unsubscribe = service.queries.storyDocs.subscribe(
      { id: 'button' },
      (value) => value?.name,
      (state) => selected.push(state.data)
    );

    await service.commands.extractStoryDocs({ id: 'button' });
    unsubscribe();

    expect(selected.at(-1)).toBe('Button');
  });

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
      service.queries.liveSnippet.loaded({ storyId: 'button--primary', args: { label: 'Go' } })
    ).resolves.toEqual({ snippet: '<Button label="Go" />' });
    expect(
      service.queries.liveSnippet.get({ storyId: 'button--primary', args: {}, unset: ['label'] })
    ).toEqual({ snippet: '<Button label="undefined" />' });
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
    beforeEach(() => {
      registerTestModuleGraphService();
    });

    it('re-extracts a component when any of its story files changes', async () => {
      const entries = [
        { ...makeStoryEntry('vega--bar', 'Vega'), importPath: './chart.stories.tsx' },
        { ...makeStoryEntry('vega--heatmap', 'Vega'), importPath: './ranges.stories.tsx' },
      ];
      const provider = vi.fn<StoryDocsProvider['extract']>(async () => makeStoryDocsPayload());
      const getIndex = makeGetIndex(entries);
      const service = registerStoryDocsService({ getIndex, storyDocsProvider: provider });
      subscribeStoryDocsToModuleGraphChanges({ getIndex, workingDir: process.cwd() });

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
      subscribeStoryDocsToModuleGraphChanges({ getIndex, workingDir: process.cwd() });

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
      subscribeStoryDocsToModuleGraphChanges({ getIndex, workingDir: process.cwd() });

      const moduleGraph = getService('core/module-graph', { internal: true });
      await moduleGraph.commands._applyGraphUpdate({
        bumpedStoryFiles: ['./button.stories.tsx'],
      });

      // Nothing was extracted, so the story-file update has no component to refresh.
      await expect(vi.waitFor(() => expect(provider).toHaveBeenCalled())).rejects.toThrow();
    });
  });
});
