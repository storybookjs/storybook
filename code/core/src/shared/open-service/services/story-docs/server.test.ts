import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IndexEntry, StoryIndex } from '../../../../types/modules/indexer.ts';
import { buildStaticFiles, clearRegistry, getService } from '../../server.ts';
import { registerTestModuleGraphService } from '../module-graph/module-graph.test-helpers.ts';
import { registerStoryDocsService, subscribeStoryDocsToModuleGraphChanges } from './server.ts';
import type { SnippetTemplate } from '../../../../docs-tools/snippetTemplate.ts';
import type { ProvidedStoryDocsPayload, StoryDocsPayload, StoryDocsProvider } from './types.ts';

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
    const provider = vi.fn<StoryDocsProvider>(async () => payload);

    const service = registerStoryDocsService({
      getIndex: makeGetIndex([entry]),
      storyDocsProvider: provider,
    });

    await expect(service.commands.extractStoryDocs({ id: 'button' })).resolves.toEqual(payload);
    expect(service.queries.storyDocs.get({ id: 'button' })).toEqual(payload);
    expect(provider).toHaveBeenCalledWith({ entry });
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
    const service = registerStoryDocsService({
      getIndex: makeGetIndex([entry]),
      storyDocsProvider: async () =>
        makeStoryDocsPayload({ stories: Object.fromEntries(stories.map((s) => [s.id, s])) }),
    });
    await service.commands.extractStoryDocs({ id: 'button' });
    expect(service.queries.storyTemplates.get({ id: 'button' })).toEqual({
      stories: {
        [stories[0]!.id]: stories[0]!.template,
        [stories[1]!.id]: stories[1]!.template,
      },
    });
  });

  describe('templates', () => {
    const entry = makeStoryEntry('button--primary', 'Button');
    const provided: ProvidedStoryDocsPayload = {
      ...makeStoryDocsPayload(),
      import: "import { Button } from './Button';",
      stories: {
        'button--primary': {
          id: 'button--primary',
          name: 'Primary',
          snippet: '<Button label="Hi" />',
          template: buttonTemplate(),
        },
        'button--plain': { id: 'button--plain', name: 'Plain', snippet: '<Button />' },
      },
    };
    const register = (payload: ProvidedStoryDocsPayload) =>
      registerStoryDocsService({
        getIndex: makeGetIndex([entry]),
        storyDocsProvider: async () => payload,
      });

    it('keeps them out of the story docs, which agents and the components manifest read', async () => {
      const service = register(provided);

      const extracted = await service.commands.extractStoryDocs({ id: 'button' });

      const stories = {
        'button--primary': {
          id: 'button--primary',
          name: 'Primary',
          snippet: '<Button label="Hi" />',
        },
        'button--plain': { id: 'button--plain', name: 'Plain', snippet: '<Button />' },
      };
      expect(extracted).toEqual({ ...provided, stories });
      expect(service.queries.storyDocs.get({ id: 'button' })).toEqual({ ...provided, stories });
      expect(service.queries.storyTemplates.get({ id: 'button' })).toEqual({
        import: provided.import,
        stories: { 'button--primary': buttonTemplate() },
      });
    });

    it('load with the story docs, in one extraction', async () => {
      const provider = vi.fn<StoryDocsProvider>(async () => provided);
      const service = registerStoryDocsService({
        getIndex: makeGetIndex([entry]),
        storyDocsProvider: provider,
      });

      await Promise.all([
        service.queries.storyDocs.loaded({ id: 'button' }),
        service.queries.storyTemplates.loaded({ id: 'button' }),
      ]);

      expect(provider).toHaveBeenCalledOnce();
      expect(service.queries.storyTemplates.get({ id: 'button' })?.stories).toHaveProperty(
        'button--primary'
      );
    });

    it('stores none for a component whose stories have none, so the preview knows they loaded', async () => {
      const service = register(makeStoryDocsPayload());

      await service.commands.extractStoryDocs({ id: 'button' });

      expect(service.queries.storyTemplates.get({ id: 'button' })).toEqual({ stories: {} });
    });

    it('reach a story-docs subscription whose selector reads them, without loading them', async () => {
      let payload = provided;
      const service = registerStoryDocsService({
        getIndex: makeGetIndex([entry]),
        storyDocsProvider: async () => payload,
      });
      await service.commands.extractStoryDocs({ id: 'button' });
      const templates = vi.spyOn(service.queries.storyTemplates, 'loaded');
      const selected: unknown[] = [];
      const unsubscribe = service.queries.storyDocs.subscribe(
        { id: 'button' },
        () => service.queries.storyTemplates.get({ id: 'button' })?.stories['button--primary'],
        (state) => selected.push(state.data)
      );

      // A server update that changes a template but no snippet.
      const primary = provided.stories['button--primary']!;
      payload = {
        ...provided,
        stories: {
          ...provided.stories,
          'button--primary': { ...primary, template: buttonTemplate('label="Hi"', 'x') },
        },
      };
      await service.commands.extractStoryDocs({ id: 'button' });
      unsubscribe();

      expect(selected.at(-1)).toEqual(buttonTemplate('label="Hi"', 'x'));
      expect(templates).not.toHaveBeenCalled();
    });

    it('writes them to a static file of their own, apart from the story docs', async () => {
      register(provided);

      const store = await buildStaticFiles();

      expect(store['core/story-docs/button.json']).toEqual({
        components: { button: { ...provided, stories: expect.any(Object) } },
      });
      expect(JSON.stringify(store['core/story-docs/button.json'])).not.toContain('"template"');
      expect(store['core/story-docs/templates/button.json']).toEqual({
        templates: {
          button: {
            import: provided.import,
            stories: { 'button--primary': buttonTemplate() },
          },
        },
      });
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

    const extractFile: StoryDocsProvider = async ({ entry }) => ({
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
      });

      const payload = await service.commands.extractStoryDocs({ id: 'vega' });

      expect(payload).not.toHaveProperty('import');
      expect(payload!.stories['vega--bar']!.snippet).toBe(
        `import { Vega } from '${chart}';\n\n<Vega />`
      );
      expect(payload!.stories['vega--heatmap']!.snippet).toBe(
        `import { Vega } from '${ranges}';\n\n<Vega />`
      );
      expect(service.queries.storyTemplates.get({ id: 'vega' })!.stories['vega--heatmap']).toEqual([
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
    const provider = vi.fn<StoryDocsProvider>(async () => payload);
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
      const provider = vi.fn<StoryDocsProvider>(async () => makeStoryDocsPayload());
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
      const provider = vi.fn<StoryDocsProvider>(async () => makeStoryDocsPayload());
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

    it('does not re-extract components that were never extracted', async () => {
      const provider = vi.fn<StoryDocsProvider>(async () => makeStoryDocsPayload());
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
