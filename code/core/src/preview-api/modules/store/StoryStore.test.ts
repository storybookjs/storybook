import { describe, it, expect, vi } from 'vitest';
import type { Renderer, ProjectAnnotations, StoryIndex } from '@storybook/core/types';

import { prepareStory } from './csf/prepareStory';
import { processCSFFile } from './csf/processCSFFile';
import { StoryStore } from './StoryStore';
import type { HooksContext } from './hooks';
import { composeConfigs } from './csf/composeConfigs';

// Spy on prepareStory/processCSFFile
vi.mock('./csf/prepareStory', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./csf/prepareStory')>();
  return {
    ...actual,
    prepareStory: vi.fn(actual.prepareStory),
  };
});
vi.mock('./csf/processCSFFile', async (importOriginal) => ({
  processCSFFile: vi.fn(
    (await importOriginal<typeof import('./csf/processCSFFile')>()).processCSFFile
  ),
}));

vi.mock('@storybook/global', async (importOriginal) => ({
  global: {
    ...(await importOriginal<typeof import('@storybook/global')>()),
  },
}));

vi.mock('@storybook/core/client-logger');

const componentOneExports = {
  default: { title: 'Component One' },
  a: { args: { foo: 'a' } },
  b: { args: { foo: 'b' } },
};
const componentTwoExports = {
  default: { title: 'Component Two' },
  c: { args: { foo: 'c' } },
};
const importFn = vi.fn(async (path) => {
  return path === './src/ComponentOne.stories.js' ? componentOneExports : componentTwoExports;
});

const projectAnnotations: ProjectAnnotations<any> = composeConfigs([
  {
    globals: { a: 'b' },
    globalTypes: { a: { type: 'string' } },
    argTypes: { a: { type: 'string' } },
    render: vi.fn(),
  },
]);

const storyIndex: StoryIndex = {
  v: 5,
  entries: {
    'component-one--a': {
      type: 'story',
      id: 'component-one--a',
      title: 'Component One',
      name: 'A',
      importPath: './src/ComponentOne.stories.js',
    },
    'component-one--b': {
      type: 'story',
      id: 'component-one--b',
      title: 'Component One',
      name: 'B',
      importPath: './src/ComponentOne.stories.js',
    },
    'component-two--c': {
      type: 'story',
      id: 'component-two--c',
      title: 'Component Two',
      name: 'C',
      importPath: './src/ComponentTwo.stories.js',
    },
  },
};

describe('StoryStore', () => {
  describe('projectAnnotations', () => {
    it('normalizes on initialization', async () => {
      const store = new StoryStore(storyIndex, importFn, projectAnnotations);

      expect(store.projectAnnotations!.globalTypes).toEqual({
        a: { name: 'a', type: { name: 'string' } },
      });
      expect(store.projectAnnotations!.argTypes).toEqual({
        a: { name: 'a', type: { name: 'string' } },
      });
    });

    it('normalizes on updateGlobalAnnotations', async () => {
      const store = new StoryStore(storyIndex, importFn, projectAnnotations);

      store.setProjectAnnotations(projectAnnotations);
      expect(store.projectAnnotations!.globalTypes).toEqual({
        a: { name: 'a', type: { name: 'string' } },
      });
      expect(store.projectAnnotations!.argTypes).toEqual({
        a: { name: 'a', type: { name: 'string' } },
      });
    });
  });

  describe('loadStory', () => {
    it('pulls the story via the importFn', async () => {
      const store = new StoryStore(storyIndex, importFn, projectAnnotations);

      importFn.mockClear();
      expect(await store.loadStory({ storyId: 'component-one--a' })).toMatchObject({
        id: 'component-one--a',
        name: 'A',
        title: 'Component One',
        initialArgs: { foo: 'a' },
      });
      expect(importFn).toHaveBeenCalledWith('./src/ComponentOne.stories.js');
    });

    it('uses a cache', async () => {
      const store = new StoryStore(storyIndex, importFn, projectAnnotations);

      const story = await store.loadStory({ storyId: 'component-one--a' });
      expect(processCSFFile).toHaveBeenCalledTimes(1);
      expect(prepareStory).toHaveBeenCalledTimes(1);

      // We are intentionally checking exact equality here, we need the object to be identical
      expect(await store.loadStory({ storyId: 'component-one--a' })).toBe(story);
      expect(processCSFFile).toHaveBeenCalledTimes(1);
      expect(prepareStory).toHaveBeenCalledTimes(1);

      await store.loadStory({ storyId: 'component-one--b' });
      expect(processCSFFile).toHaveBeenCalledTimes(1);
      expect(prepareStory).toHaveBeenCalledTimes(2);

      await store.loadStory({ storyId: 'component-two--c' });
      expect(processCSFFile).toHaveBeenCalledTimes(2);
      expect(prepareStory).toHaveBeenCalledTimes(3);
    });
  });

  describe('setProjectAnnotations', () => {
    it('busts the loadStory cache', async () => {
      const store = new StoryStore(storyIndex, importFn, projectAnnotations);

      const story = await store.loadStory({ storyId: 'component-one--a' });
      expect(processCSFFile).toHaveBeenCalledTimes(1);
      expect(prepareStory).toHaveBeenCalledTimes(1);

      store.setProjectAnnotations({ ...projectAnnotations, decorators: [vi.fn()] });

      // We are intentionally checking exact equality here, we need the object to be identical
      expect(await store.loadStory({ storyId: 'component-one--a' })).not.toBe(story);
      expect(processCSFFile).toHaveBeenCalledTimes(1);
      expect(prepareStory).toHaveBeenCalledTimes(2);
    });
  });

  describe('onStoriesChanged', () => {
    it('busts the loadStory cache if the importFn returns a new module', async () => {
      const store = new StoryStore(storyIndex, importFn, projectAnnotations);

      const story = await store.loadStory({ storyId: 'component-one--a' });
      expect(processCSFFile).toHaveBeenCalledTimes(1);
      expect(prepareStory).toHaveBeenCalledTimes(1);

      await store.onStoriesChanged({
        importFn: async () => ({
          ...componentOneExports,
          c: { args: { foo: 'c' } },
        }),
      });

      // The object is not identical which will cause it to be treated as a new story
      expect(await store.loadStory({ storyId: 'component-one--a' })).not.toBe(story);
      expect(processCSFFile).toHaveBeenCalledTimes(2);
      expect(prepareStory).toHaveBeenCalledTimes(2);
    });

    it('busts the loadStory cache if the csf file no longer appears in the index', async () => {
      const store = new StoryStore(storyIndex, importFn, projectAnnotations);

      await store.loadStory({ storyId: 'component-one--a' });
      expect(processCSFFile).toHaveBeenCalledTimes(1);
      expect(prepareStory).toHaveBeenCalledTimes(1);

      // The stories are no longer in the index
      await store.onStoriesChanged({ storyIndex: { v: 5, entries: {} } });

      await expect(store.loadStory({ storyId: 'component-one--a' })).rejects.toThrow();

      // We don't load or process any CSF
      expect(processCSFFile).toHaveBeenCalledTimes(1);
      expect(prepareStory).toHaveBeenCalledTimes(1);
    });

    it('reuses the cache if a story importPath has not changed', async () => {
      const store = new StoryStore(storyIndex, importFn, projectAnnotations);

      const story = await store.loadStory({ storyId: 'component-one--a' });
      expect(processCSFFile).toHaveBeenCalledTimes(1);
      expect(prepareStory).toHaveBeenCalledTimes(1);

      // Add a new story to the index that isn't different
      await store.onStoriesChanged({
        storyIndex: {
          v: 5,
          entries: {
            ...storyIndex.entries,
            'new-component--story': {
              type: 'story',
              id: 'new-component--story',
              title: 'New Component',
              name: 'Story',
              importPath: './new-component.stories.js',
            },
          },
        },
      });

      // We are intentionally checking exact equality here, we need the object to be identical
      expect(await store.loadStory({ storyId: 'component-one--a' })).toEqual(story);
      expect(processCSFFile).toHaveBeenCalledTimes(1);
      expect(prepareStory).toHaveBeenCalledTimes(1);
    });

    it('imports with a new path for a story id if provided', async () => {
      const store = new StoryStore(storyIndex, importFn, projectAnnotations);

      await store.loadStory({ storyId: 'component-one--a' });
      expect(importFn).toHaveBeenCalledWith(storyIndex.entries['component-one--a'].importPath);

      const newImportPath = './src/ComponentOne-new.stories.js';
      const newImportFn = vi.fn(async () => componentOneExports);
      await store.onStoriesChanged({
        importFn: newImportFn,
        storyIndex: {
          v: 5,
          entries: {
            'component-one--a': {
              type: 'story',
              id: 'component-one--a',
              title: 'Component One',
              name: 'A',
              importPath: newImportPath,
            },
          },
        },
      });

      await store.loadStory({ storyId: 'component-one--a' });
      expect(newImportFn).toHaveBeenCalledWith(newImportPath);
    });

    it('re-caches stories if the were cached already', async () => {
      const store = new StoryStore(storyIndex, importFn, projectAnnotations);
      await store.cacheAllCSFFiles();

      await store.loadStory({ storyId: 'component-one--a' });
      expect(importFn).toHaveBeenCalledWith(storyIndex.entries['component-one--a'].importPath);

      const newImportPath = './src/ComponentOne-new.stories.js';
      const newImportFn = vi.fn(async () => componentOneExports);
      await store.onStoriesChanged({
        importFn: newImportFn,
        storyIndex: {
          v: 5,
          entries: {
            'component-one--a': {
              type: 'story',
              id: 'component-one--a',
              title: 'Component One',
              name: 'A',
              importPath: newImportPath,
            },
          },
        },
      });

      expect(store.extract()).toMatchInlineSnapshot(`
        {
          "component-one--a": {
            "argTypes": {
              "a": {
                "name": "a",
                "type": {
                  "name": "string",
                },
              },
              "foo": {
                "name": "foo",
                "type": {
                  "name": "string",
                },
              },
            },
            "args": {
              "foo": "a",
            },
            "component": undefined,
            "componentId": "component-one",
            "id": "component-one--a",
            "initialArgs": {
              "foo": "a",
            },
            "kind": "Component One",
            "name": "A",
            "parameters": {
              "__isArgsStory": false,
              "fileName": "./src/ComponentOne-new.stories.js",
            },
            "playFunction": undefined,
            "renderToCanvas": undefined,
            "story": "A",
            "storyGlobals": {},
            "subcomponents": undefined,
            "tags": [
              "dev",
              "test",
            ],
            "testingLibraryRender": undefined,
            "title": "Component One",
            "usesMount": false,
          },
        }
      `);
    });
  });

  describe('componentStoriesFromCSFFile', () => {
    it('returns all the stories in the file', async () => {
      const store = new StoryStore(storyIndex, importFn, projectAnnotations);

      const csfFile = await store.loadCSFFileByStoryId('component-one--a');
      const stories = store.componentStoriesFromCSFFile({ csfFile });

      expect(stories).toHaveLength(2);
      expect(stories.map((s) => s.id)).toEqual(['component-one--a', 'component-one--b']);
    });

    it('returns them in the order they are in the index, not the file', async () => {
      const reversedIndex = {
        v: 5,
        entries: {
          'component-one--b': storyIndex.entries['component-one--b'],
          'component-one--a': storyIndex.entries['component-one--a'],
        },
      };
      const store = new StoryStore(reversedIndex, importFn, projectAnnotations);

      const csfFile = await store.loadCSFFileByStoryId('component-one--a');
      const stories = store.componentStoriesFromCSFFile({ csfFile });

      expect(stories).toHaveLength(2);
      expect(stories.map((s) => s.id)).toEqual(['component-one--b', 'component-one--a']);
    });
  });

  describe('getStoryContext', () => {
    it('returns the args and globals correctly', async () => {
      const store = new StoryStore(storyIndex, importFn, projectAnnotations);

      const story = await store.loadStory({ storyId: 'component-one--a' });

      expect(store.getStoryContext(story)).toMatchObject({
        args: { foo: 'a' },
        globals: { a: 'b' },
      });
    });

    it('returns the args and globals correctly when they change', async () => {
      const store = new StoryStore(storyIndex, importFn, projectAnnotations);

      const story = await store.loadStory({ storyId: 'component-one--a' });

      store.args.update(story.id, { foo: 'bar' });
      store.userGlobals!.update({ a: 'c' });

      expect(store.getStoryContext(story)).toMatchObject({
        args: { foo: 'bar' },
        globals: { a: 'c' },
      });
    });

    it('can force initial args', async () => {
      const store = new StoryStore(storyIndex, importFn, projectAnnotations);

      const story = await store.loadStory({ storyId: 'component-one--a' });

      store.args.update(story.id, { foo: 'bar' });

      expect(store.getStoryContext(story, { forceInitialArgs: true })).toMatchObject({
        args: { foo: 'a' },
      });
    });

    it('returns the same hooks each time', async () => {
      const store = new StoryStore(storyIndex, importFn, projectAnnotations);

      const story = await store.loadStory({ storyId: 'component-one--a' });

      const { hooks } = store.getStoryContext(story);
      expect(store.getStoryContext(story).hooks).toBe(hooks);

      // Now double check it doesn't get changed when you call `loadStory` again
      const story2 = await store.loadStory({ storyId: 'component-one--a' });
      expect(store.getStoryContext(story2).hooks).toBe(hooks);
    });
  });

  describe('cleanupStory', () => {
    it('cleans the hooks from the context', async () => {
      const store = new StoryStore(storyIndex, importFn, projectAnnotations);

      const story = await store.loadStory({ storyId: 'component-one--a' });

      const { hooks } = store.getStoryContext(story) as { hooks: HooksContext<Renderer> };
      hooks.clean = vi.fn();
      await store.cleanupStory(story);
      expect(hooks.clean).toHaveBeenCalled();
    });
  });

  describe('loadAllCSFFiles', () => {
    it('imports *all* csf files', async () => {
      const store = new StoryStore(storyIndex, importFn, projectAnnotations);

      importFn.mockClear();
      const csfFiles = await store.loadAllCSFFiles();
      expect(csfFiles).not.toBeUndefined();

      expect(Object.keys(csfFiles!)).toEqual([
        './src/ComponentOne.stories.js',
        './src/ComponentTwo.stories.js',
      ]);
    });
  });

  describe('extract', () => {
    it('throws if you have not called cacheAllCSFFiles', async () => {
      const store = new StoryStore(storyIndex, importFn, projectAnnotations);

      expect(() => store.extract()).toThrow(/Cannot call/);
    });

    it('produces objects with functions and hooks stripped', async () => {
      const store = new StoryStore(storyIndex, importFn, projectAnnotations);
      await store.cacheAllCSFFiles();

      expect(store.extract()).toMatchInlineSnapshot(`
        {
          "component-one--a": {
            "argTypes": {
              "a": {
                "name": "a",
                "type": {
                  "name": "string",
                },
              },
              "foo": {
                "name": "foo",
                "type": {
                  "name": "string",
                },
              },
            },
            "args": {
              "foo": "a",
            },
            "component": undefined,
            "componentId": "component-one",
            "id": "component-one--a",
            "initialArgs": {
              "foo": "a",
            },
            "kind": "Component One",
            "name": "A",
            "parameters": {
              "__isArgsStory": false,
              "fileName": "./src/ComponentOne.stories.js",
            },
            "playFunction": undefined,
            "renderToCanvas": undefined,
            "story": "A",
            "storyGlobals": {},
            "subcomponents": undefined,
            "tags": [
              "dev",
              "test",
            ],
            "testingLibraryRender": undefined,
            "title": "Component One",
            "usesMount": false,
          },
          "component-one--b": {
            "argTypes": {
              "a": {
                "name": "a",
                "type": {
                  "name": "string",
                },
              },
              "foo": {
                "name": "foo",
                "type": {
                  "name": "string",
                },
              },
            },
            "args": {
              "foo": "b",
            },
            "component": undefined,
            "componentId": "component-one",
            "id": "component-one--b",
            "initialArgs": {
              "foo": "b",
            },
            "kind": "Component One",
            "name": "B",
            "parameters": {
              "__isArgsStory": false,
              "fileName": "./src/ComponentOne.stories.js",
            },
            "playFunction": undefined,
            "renderToCanvas": undefined,
            "story": "B",
            "storyGlobals": {},
            "subcomponents": undefined,
            "tags": [
              "dev",
              "test",
            ],
            "testingLibraryRender": undefined,
            "title": "Component One",
            "usesMount": false,
          },
          "component-two--c": {
            "argTypes": {
              "a": {
                "name": "a",
                "type": {
                  "name": "string",
                },
              },
              "foo": {
                "name": "foo",
                "type": {
                  "name": "string",
                },
              },
            },
            "args": {
              "foo": "c",
            },
            "component": undefined,
            "componentId": "component-two",
            "id": "component-two--c",
            "initialArgs": {
              "foo": "c",
            },
            "kind": "Component Two",
            "name": "C",
            "parameters": {
              "__isArgsStory": false,
              "fileName": "./src/ComponentTwo.stories.js",
            },
            "playFunction": undefined,
            "renderToCanvas": undefined,
            "story": "C",
            "storyGlobals": {},
            "subcomponents": undefined,
            "tags": [
              "dev",
              "test",
            ],
            "testingLibraryRender": undefined,
            "title": "Component Two",
            "usesMount": false,
          },
        }
      `);
    });

    it('does not include (legacy) docs only stories by default', async () => {
      const docsOnlyImportFn = vi.fn(async (path) => {
        return path === './src/ComponentOne.stories.js'
          ? {
              ...componentOneExports,
              a: { ...componentOneExports.a, parameters: { docsOnly: true } },
            }
          : componentTwoExports;
      });
      const store = new StoryStore(storyIndex, docsOnlyImportFn, projectAnnotations);
      await store.cacheAllCSFFiles();

      expect(Object.keys(store.extract())).toEqual(['component-one--b', 'component-two--c']);

      expect(Object.keys(store.extract({ includeDocsOnly: true }))).toEqual([
        'component-one--a',
        'component-one--b',
        'component-two--c',
      ]);
    });

    it('does not include (modern) docs entries ever', async () => {
      const unnattachedStoryIndex: StoryIndex = {
        v: 5,
        entries: {
          ...storyIndex.entries,
          'introduction--docs': {
            type: 'docs',
            id: 'introduction--docs',
            title: 'Introduction',
            name: 'Docs',
            importPath: './introduction.mdx',
            storiesImports: [],
          },
        },
      };
      const store = new StoryStore(unnattachedStoryIndex, importFn, projectAnnotations);
      await store.cacheAllCSFFiles();

      expect(Object.keys(store.extract())).toEqual([
        'component-one--a',
        'component-one--b',
        'component-two--c',
      ]);

      expect(Object.keys(store.extract({ includeDocsOnly: true }))).toEqual([
        'component-one--a',
        'component-one--b',
        'component-two--c',
      ]);
    });
  });

  describe('raw', () => {
    it('produces an array of stories', async () => {
      const store = new StoryStore(storyIndex, importFn, projectAnnotations);
      await store.cacheAllCSFFiles();

      expect(store.raw()).toMatchInlineSnapshot(`
        [
          {
            "applyBeforeEach": [Function],
            "applyLoaders": [Function],
            "argTypes": {
              "a": {
                "name": "a",
                "type": {
                  "name": "string",
                },
              },
              "foo": {
                "name": "foo",
                "type": {
                  "name": "string",
                },
              },
            },
            "component": undefined,
            "componentId": "component-one",
            "id": "component-one--a",
            "initialArgs": {
              "foo": "a",
            },
            "kind": "Component One",
            "moduleExport": {
              "args": {
                "foo": "a",
              },
            },
            "mount": [Function],
            "name": "A",
            "originalStoryFn": [MockFunction spy],
            "parameters": {
              "__isArgsStory": false,
              "fileName": "./src/ComponentOne.stories.js",
            },
            "playFunction": undefined,
            "renderToCanvas": undefined,
            "runStep": [Function],
            "story": "A",
            "storyFn": [Function],
            "storyGlobals": {},
            "subcomponents": undefined,
            "tags": [
              "dev",
              "test",
            ],
            "testingLibraryRender": undefined,
            "title": "Component One",
            "unboundStoryFn": [Function],
            "undecoratedStoryFn": [Function],
            "usesMount": false,
          },
          {
            "applyBeforeEach": [Function],
            "applyLoaders": [Function],
            "argTypes": {
              "a": {
                "name": "a",
                "type": {
                  "name": "string",
                },
              },
              "foo": {
                "name": "foo",
                "type": {
                  "name": "string",
                },
              },
            },
            "component": undefined,
            "componentId": "component-one",
            "id": "component-one--b",
            "initialArgs": {
              "foo": "b",
            },
            "kind": "Component One",
            "moduleExport": {
              "args": {
                "foo": "b",
              },
            },
            "mount": [Function],
            "name": "B",
            "originalStoryFn": [MockFunction spy],
            "parameters": {
              "__isArgsStory": false,
              "fileName": "./src/ComponentOne.stories.js",
            },
            "playFunction": undefined,
            "renderToCanvas": undefined,
            "runStep": [Function],
            "story": "B",
            "storyFn": [Function],
            "storyGlobals": {},
            "subcomponents": undefined,
            "tags": [
              "dev",
              "test",
            ],
            "testingLibraryRender": undefined,
            "title": "Component One",
            "unboundStoryFn": [Function],
            "undecoratedStoryFn": [Function],
            "usesMount": false,
          },
          {
            "applyBeforeEach": [Function],
            "applyLoaders": [Function],
            "argTypes": {
              "a": {
                "name": "a",
                "type": {
                  "name": "string",
                },
              },
              "foo": {
                "name": "foo",
                "type": {
                  "name": "string",
                },
              },
            },
            "component": undefined,
            "componentId": "component-two",
            "id": "component-two--c",
            "initialArgs": {
              "foo": "c",
            },
            "kind": "Component Two",
            "moduleExport": {
              "args": {
                "foo": "c",
              },
            },
            "mount": [Function],
            "name": "C",
            "originalStoryFn": [MockFunction spy],
            "parameters": {
              "__isArgsStory": false,
              "fileName": "./src/ComponentTwo.stories.js",
            },
            "playFunction": undefined,
            "renderToCanvas": undefined,
            "runStep": [Function],
            "story": "C",
            "storyFn": [Function],
            "storyGlobals": {},
            "subcomponents": undefined,
            "tags": [
              "dev",
              "test",
            ],
            "testingLibraryRender": undefined,
            "title": "Component Two",
            "unboundStoryFn": [Function],
            "undecoratedStoryFn": [Function],
            "usesMount": false,
          },
        ]
      `);
    });
  });

  describe('getSetStoriesPayload', () => {
    it('maps stories list to payload correctly', async () => {
      const store = new StoryStore(storyIndex, importFn, projectAnnotations);
      await store.cacheAllCSFFiles();

      expect(store.getSetStoriesPayload()).toMatchInlineSnapshot(`
        {
          "globalParameters": {},
          "globals": {
            "a": "b",
          },
          "kindParameters": {
            "Component One": {},
            "Component Two": {},
          },
          "stories": {
            "component-one--a": {
              "argTypes": {
                "a": {
                  "name": "a",
                  "type": {
                    "name": "string",
                  },
                },
                "foo": {
                  "name": "foo",
                  "type": {
                    "name": "string",
                  },
                },
              },
              "args": {
                "foo": "a",
              },
              "component": undefined,
              "componentId": "component-one",
              "id": "component-one--a",
              "initialArgs": {
                "foo": "a",
              },
              "kind": "Component One",
              "name": "A",
              "parameters": {
                "__isArgsStory": false,
                "fileName": "./src/ComponentOne.stories.js",
              },
              "playFunction": undefined,
              "renderToCanvas": undefined,
              "story": "A",
              "storyGlobals": {},
              "subcomponents": undefined,
              "tags": [
                "dev",
                "test",
              ],
              "testingLibraryRender": undefined,
              "title": "Component One",
              "usesMount": false,
            },
            "component-one--b": {
              "argTypes": {
                "a": {
                  "name": "a",
                  "type": {
                    "name": "string",
                  },
                },
                "foo": {
                  "name": "foo",
                  "type": {
                    "name": "string",
                  },
                },
              },
              "args": {
                "foo": "b",
              },
              "component": undefined,
              "componentId": "component-one",
              "id": "component-one--b",
              "initialArgs": {
                "foo": "b",
              },
              "kind": "Component One",
              "name": "B",
              "parameters": {
                "__isArgsStory": false,
                "fileName": "./src/ComponentOne.stories.js",
              },
              "playFunction": undefined,
              "renderToCanvas": undefined,
              "story": "B",
              "storyGlobals": {},
              "subcomponents": undefined,
              "tags": [
                "dev",
                "test",
              ],
              "testingLibraryRender": undefined,
              "title": "Component One",
              "usesMount": false,
            },
            "component-two--c": {
              "argTypes": {
                "a": {
                  "name": "a",
                  "type": {
                    "name": "string",
                  },
                },
                "foo": {
                  "name": "foo",
                  "type": {
                    "name": "string",
                  },
                },
              },
              "args": {
                "foo": "c",
              },
              "component": undefined,
              "componentId": "component-two",
              "id": "component-two--c",
              "initialArgs": {
                "foo": "c",
              },
              "kind": "Component Two",
              "name": "C",
              "parameters": {
                "__isArgsStory": false,
                "fileName": "./src/ComponentTwo.stories.js",
              },
              "playFunction": undefined,
              "renderToCanvas": undefined,
              "story": "C",
              "storyGlobals": {},
              "subcomponents": undefined,
              "tags": [
                "dev",
                "test",
              ],
              "testingLibraryRender": undefined,
              "title": "Component Two",
              "usesMount": false,
            },
          },
          "v": 2,
        }
      `);
    });
  });

  describe('getStoriesJsonData', () => {
    describe('in back-compat mode', () => {
      it('maps stories list to payload correctly', async () => {
        const store = new StoryStore(storyIndex, importFn, projectAnnotations);
        await store.cacheAllCSFFiles();

        expect(store.getStoriesJsonData()).toMatchInlineSnapshot(`
          {
            "stories": {
              "component-one--a": {
                "id": "component-one--a",
                "importPath": "./src/ComponentOne.stories.js",
                "kind": "Component One",
                "name": "A",
                "parameters": {
                  "__isArgsStory": false,
                  "fileName": "./src/ComponentOne.stories.js",
                },
                "story": "A",
                "title": "Component One",
              },
              "component-one--b": {
                "id": "component-one--b",
                "importPath": "./src/ComponentOne.stories.js",
                "kind": "Component One",
                "name": "B",
                "parameters": {
                  "__isArgsStory": false,
                  "fileName": "./src/ComponentOne.stories.js",
                },
                "story": "B",
                "title": "Component One",
              },
              "component-two--c": {
                "id": "component-two--c",
                "importPath": "./src/ComponentTwo.stories.js",
                "kind": "Component Two",
                "name": "C",
                "parameters": {
                  "__isArgsStory": false,
                  "fileName": "./src/ComponentTwo.stories.js",
                },
                "story": "C",
                "title": "Component Two",
              },
            },
            "v": 3,
          }
        `);
      });
    });
  });
});
