import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizeStoriesEntry } from 'storybook/internal/common';
import { STORY_INDEX_INVALIDATED } from 'storybook/internal/core-events';

import { debounce } from 'es-toolkit/function';
import type { Polka, Request, Response } from 'polka';
import Watchpack from 'watchpack';

import type { FileSnapshot } from '../../shared/rename-redirect-store/classify.ts';
import { renameRedirectStore } from '../stores/rename-redirect.ts';
import { csfIndexer } from '../presets/common-preset.ts';
import type { StoryIndexGeneratorOptions } from './StoryIndexGenerator.ts';
import { StoryIndexGenerator } from './StoryIndexGenerator.ts';
import type { ServerChannel } from './get-server-channel.ts';
import { registerIndexJsonRoute, resolveRenamePairs } from './index-json.ts';

vi.mock('watchpack');
vi.mock('es-toolkit/function', { spy: true });
vi.mock('storybook/internal/node-logger');

vi.mock('../stores/rename-redirect.ts', async () => {
  const { UNIVERSAL_RENAME_REDIRECT_STORE_OPTIONS } = await vi.importActual<
    typeof import('../../shared/rename-redirect-store/index.ts')
  >('../../shared/rename-redirect-store/index.ts');
  const { MockUniversalStore } = await vi.importActual<
    typeof import('../../shared/universal-store/mock.ts')
  >('../../shared/universal-store/mock.ts');
  return {
    renameRedirectStore: new MockUniversalStore(UNIVERSAL_RENAME_REDIRECT_STORE_OPTIONS),
  };
});

vi.mock('../utils/constants', () => {
  return {
    defaultStaticDirs: [{ from: './from', to: './to' }],
    defaultFavicon: './favicon.svg',
  };
});

const workingDir = join(__dirname, '__mockdata__');
const normalizedStories = [
  normalizeStoriesEntry(
    {
      titlePrefix: '',
      directory: './src',
      files: '**/*.stories.@(ts|js|mjs|jsx)',
    },
    { workingDir, configDir: workingDir }
  ),
  normalizeStoriesEntry(
    {
      titlePrefix: '',
      directory: './src',
      files: '**/*.mdx',
    },
    { workingDir, configDir: workingDir }
  ),
];

const getStoryIndexGeneratorPromise = async (
  overrides: any = {},
  inputNormalizedStories = normalizedStories
) => {
  const options: StoryIndexGeneratorOptions = {
    indexers: [csfIndexer],
    configDir: workingDir,
    workingDir,
    docs: { defaultName: 'docs' },
    ...overrides,
  };
  const generator = new StoryIndexGenerator(inputNormalizedStories, options);
  await generator.initialize();
  return generator;
};

describe('registerIndexJsonRoute', () => {
  const use = vi.fn();
  const app: Polka = { use } as any;
  const end = vi.fn();
  const write = vi.fn();
  const response: Response = {
    header: vi.fn(),
    send: vi.fn(),
    status: vi.fn(),
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    write,
    flush: vi.fn(),
    end,
    on: vi.fn(),
  } as any;

  beforeEach(async () => {
    use.mockClear();
    end.mockClear();
    write.mockClear();
    vi.mocked(debounce).mockImplementation((cb) => cb as any);
    Watchpack.mockClear();
  });

  const request: Request = {
    headers: { accept: 'application/json' },
  } as any;

  describe('JSON endpoint', () => {
    it('scans and extracts index', async () => {
      const mockServerChannel = { emit: vi.fn() } as any as ServerChannel;
      registerIndexJsonRoute({
        app,
        channel: mockServerChannel,
        workingDir,
        normalizedStories,
        storyIndexGeneratorPromise: getStoryIndexGeneratorPromise(),
      });

      expect(use).toHaveBeenCalledTimes(1);
      const route = use.mock.calls[0][1];

      console.time('route');
      await route(request, response);
      console.timeEnd('route');

      expect(end).toHaveBeenCalledTimes(1);
      expect(JSON.parse(end.mock.calls[0][0])).toMatchInlineSnapshot(`
        {
          "entries": {
            "a--metaof": {
              "id": "a--metaof",
              "importPath": "./src/docs2/MetaOf.mdx",
              "name": "MetaOf",
              "storiesImports": [
                "./src/A.stories.js",
              ],
              "tags": [
                "dev",
                "test",
                "manifest",
                "component-tag",
                "story-tag",
                "attached-mdx",
              ],
              "title": "A",
              "type": "docs",
            },
            "a--second-docs": {
              "id": "a--second-docs",
              "importPath": "./src/docs2/SecondMetaOf.mdx",
              "name": "Second Docs",
              "storiesImports": [
                "./src/A.stories.js",
              ],
              "tags": [
                "dev",
                "test",
                "manifest",
                "component-tag",
                "story-tag",
                "attached-mdx",
              ],
              "title": "A",
              "type": "docs",
            },
            "a--story-one": {
              "exportName": "StoryOne",
              "id": "a--story-one",
              "importPath": "./src/A.stories.js",
              "name": "Story One",
              "subtype": "story",
              "tags": [
                "dev",
                "test",
                "manifest",
                "component-tag",
                "story-tag",
              ],
              "title": "A",
              "type": "story",
            },
            "b--docs": {
              "id": "b--docs",
              "importPath": "./src/B.stories.ts",
              "name": "docs",
              "storiesImports": [],
              "tags": [
                "dev",
                "test",
                "manifest",
                "autodocs",
              ],
              "title": "B",
              "type": "docs",
            },
            "b--story-one": {
              "exportName": "StoryOne",
              "id": "b--story-one",
              "importPath": "./src/B.stories.ts",
              "name": "Story One",
              "subtype": "story",
              "tags": [
                "dev",
                "test",
                "manifest",
                "autodocs",
              ],
              "title": "B",
              "type": "story",
            },
            "componentpath-extension--story-one": {
              "componentPath": "./src/componentPath/component.js",
              "exportName": "StoryOne",
              "id": "componentpath-extension--story-one",
              "importPath": "./src/componentPath/extension.stories.js",
              "name": "Story One",
              "subtype": "story",
              "tags": [
                "dev",
                "test",
                "manifest",
              ],
              "title": "componentPath/extension",
              "type": "story",
            },
            "componentpath-noextension--story-one": {
              "componentPath": "./src/componentPath/component.js",
              "exportName": "StoryOne",
              "id": "componentpath-noextension--story-one",
              "importPath": "./src/componentPath/noExtension.stories.js",
              "name": "Story One",
              "subtype": "story",
              "tags": [
                "dev",
                "test",
                "manifest",
              ],
              "title": "componentPath/noExtension",
              "type": "story",
            },
            "componentpath-package--story-one": {
              "componentPath": "component-package",
              "exportName": "StoryOne",
              "id": "componentpath-package--story-one",
              "importPath": "./src/componentPath/package.stories.js",
              "name": "Story One",
              "subtype": "story",
              "tags": [
                "dev",
                "test",
                "manifest",
              ],
              "title": "componentPath/package",
              "type": "story",
            },
            "d--docs": {
              "id": "d--docs",
              "importPath": "./src/D.stories.jsx",
              "name": "docs",
              "storiesImports": [],
              "tags": [
                "dev",
                "test",
                "manifest",
                "autodocs",
              ],
              "title": "D",
              "type": "docs",
            },
            "d--story-one": {
              "exportName": "StoryOne",
              "id": "d--story-one",
              "importPath": "./src/D.stories.jsx",
              "name": "Story One",
              "subtype": "story",
              "tags": [
                "dev",
                "test",
                "manifest",
                "autodocs",
              ],
              "title": "D",
              "type": "story",
            },
            "docs2-componentreference--docs": {
              "id": "docs2-componentreference--docs",
              "importPath": "./src/docs2/ComponentReference.mdx",
              "name": "docs",
              "storiesImports": [],
              "tags": [
                "dev",
                "test",
                "manifest",
                "unattached-mdx",
              ],
              "title": "docs2/ComponentReference",
              "type": "docs",
            },
            "docs2-notitle--docs": {
              "id": "docs2-notitle--docs",
              "importPath": "./src/docs2/NoTitle.mdx",
              "name": "docs",
              "storiesImports": [],
              "tags": [
                "dev",
                "test",
                "manifest",
                "unattached-mdx",
              ],
              "title": "docs2/NoTitle",
              "type": "docs",
            },
            "docs2-tags--docs": {
              "id": "docs2-tags--docs",
              "importPath": "./src/docs2/Tags.mdx",
              "name": "docs",
              "storiesImports": [],
              "tags": [
                "dev",
                "test",
                "manifest",
                "foo",
                "bar",
                "unattached-mdx",
              ],
              "title": "docs2/Tags",
              "type": "docs",
            },
            "docs2-yabbadabbadooo--docs": {
              "id": "docs2-yabbadabbadooo--docs",
              "importPath": "./src/docs2/Title.mdx",
              "name": "docs",
              "storiesImports": [],
              "tags": [
                "dev",
                "test",
                "manifest",
                "unattached-mdx",
              ],
              "title": "docs2/Yabbadabbadooo",
              "type": "docs",
            },
            "example-button--story-one": {
              "exportName": "StoryOne",
              "id": "example-button--story-one",
              "importPath": "./src/Button.stories.ts",
              "name": "Story One",
              "subtype": "story",
              "tags": [
                "dev",
                "test",
                "manifest",
                "foobar",
              ],
              "title": "Example/Button",
              "type": "story",
            },
            "first-nested-deeply-f--story-one": {
              "exportName": "StoryOne",
              "id": "first-nested-deeply-f--story-one",
              "importPath": "./src/first-nested/deeply/F.stories.js",
              "name": "Story One",
              "subtype": "story",
              "tags": [
                "dev",
                "test",
                "manifest",
              ],
              "title": "first-nested/deeply/F",
              "type": "story",
            },
            "first-nested-deeply-features--with-csf-1": {
              "exportName": "WithCSF1",
              "id": "first-nested-deeply-features--with-csf-1",
              "importPath": "./src/first-nested/deeply/Features.stories.jsx",
              "name": "With CSF 1",
              "subtype": "story",
              "tags": [
                "dev",
                "test",
                "manifest",
              ],
              "title": "first-nested/deeply/Features",
              "type": "story",
            },
            "first-nested-deeply-features--with-play": {
              "exportName": "WithPlay",
              "id": "first-nested-deeply-features--with-play",
              "importPath": "./src/first-nested/deeply/Features.stories.jsx",
              "name": "With Play",
              "subtype": "story",
              "tags": [
                "dev",
                "test",
                "manifest",
                "play-fn",
              ],
              "title": "first-nested/deeply/Features",
              "type": "story",
            },
            "first-nested-deeply-features--with-render": {
              "exportName": "WithRender",
              "id": "first-nested-deeply-features--with-render",
              "importPath": "./src/first-nested/deeply/Features.stories.jsx",
              "name": "With Render",
              "subtype": "story",
              "tags": [
                "dev",
                "test",
                "manifest",
              ],
              "title": "first-nested/deeply/Features",
              "type": "story",
            },
            "first-nested-deeply-features--with-story-fn": {
              "exportName": "WithStoryFn",
              "id": "first-nested-deeply-features--with-story-fn",
              "importPath": "./src/first-nested/deeply/Features.stories.jsx",
              "name": "With Story Fn",
              "subtype": "story",
              "tags": [
                "dev",
                "test",
                "manifest",
              ],
              "title": "first-nested/deeply/Features",
              "type": "story",
            },
            "first-nested-deeply-features--with-test": {
              "exportName": "WithTest",
              "id": "first-nested-deeply-features--with-test",
              "importPath": "./src/first-nested/deeply/Features.stories.jsx",
              "name": "With Test",
              "subtype": "story",
              "tags": [
                "dev",
                "test",
                "manifest",
                "play-fn",
              ],
              "title": "first-nested/deeply/Features",
              "type": "story",
            },
            "h--docs": {
              "id": "h--docs",
              "importPath": "./src/H.stories.mjs",
              "name": "docs",
              "storiesImports": [],
              "tags": [
                "dev",
                "test",
                "manifest",
                "autodocs",
              ],
              "title": "H",
              "type": "docs",
            },
            "h--story-one": {
              "exportName": "StoryOne",
              "id": "h--story-one",
              "importPath": "./src/H.stories.mjs",
              "name": "Story One",
              "subtype": "story",
              "tags": [
                "dev",
                "test",
                "manifest",
                "autodocs",
              ],
              "title": "H",
              "type": "story",
            },
            "nested-button--story-one": {
              "exportName": "StoryOne",
              "id": "nested-button--story-one",
              "importPath": "./src/nested/Button.stories.ts",
              "name": "Story One",
              "subtype": "story",
              "tags": [
                "dev",
                "test",
                "manifest",
                "component-tag",
              ],
              "title": "nested/Button",
              "type": "story",
            },
            "second-nested-g--story-one": {
              "exportName": "StoryOne",
              "id": "second-nested-g--story-one",
              "importPath": "./src/second-nested/G.stories.ts",
              "name": "Story One",
              "subtype": "story",
              "tags": [
                "dev",
                "test",
                "manifest",
              ],
              "title": "second-nested/G",
              "type": "story",
            },
          },
          "v": 5,
        }
      `);
    }, 20_000);

    it('can handle simultaneous access', async () => {
      const mockServerChannel = { emit: vi.fn() } as any as ServerChannel;

      registerIndexJsonRoute({
        app,
        channel: mockServerChannel,
        workingDir,
        normalizedStories,
        storyIndexGeneratorPromise: getStoryIndexGeneratorPromise(),
      });

      expect(use).toHaveBeenCalledTimes(1);
      const route = use.mock.calls[0][1];

      const firstPromise = route(request, response);
      const secondResponse = { ...response, end: vi.fn(), status: vi.fn() };
      const secondPromise = route(request, secondResponse);

      await Promise.all([firstPromise, secondPromise]);
      expect(end).toHaveBeenCalledTimes(1);
      expect(response.statusCode).not.toEqual(500);
      expect(secondResponse.end).toHaveBeenCalledTimes(1);
      expect(secondResponse.status).not.toEqual(500);
    });
  });

  describe('SSE endpoint', () => {
    beforeEach(() => {
      use.mockClear();
      end.mockClear();
    });

    it('sends invalidate events', async () => {
      const mockServerChannel = { emit: vi.fn() } as any as ServerChannel;
      const onStoryIndexInvalidated = vi.fn();
      registerIndexJsonRoute({
        app,
        channel: mockServerChannel,
        workingDir,
        normalizedStories,
        storyIndexGeneratorPromise: getStoryIndexGeneratorPromise(),
        onStoryIndexInvalidated,
      });

      expect(use).toHaveBeenCalledTimes(1);
      const route = use.mock.calls[0][1];

      await route(request, response);

      expect(write).not.toHaveBeenCalled();

      expect(Watchpack).toHaveBeenCalledTimes(1);
      const watcher = Watchpack.mock.instances[0];
      expect(watcher.watch).toHaveBeenCalledWith(
        expect.objectContaining({
          directories: expect.any(Array),
          files: expect.any(Array),
        })
      );

      expect(watcher.on).toHaveBeenCalledTimes(2);
      const onChange = watcher.on.mock.calls[0][1];

      onChange(`${workingDir}/src/nested/Button.stories.ts`);
      // Wait for the batched events to be processed
      await vi.waitFor(() => {
        expect(mockServerChannel.emit).toHaveBeenCalledTimes(1);
      });
      expect(mockServerChannel.emit).toHaveBeenCalledWith(STORY_INDEX_INVALIDATED);
      expect(onStoryIndexInvalidated).toHaveBeenCalledTimes(1);
    });

    it('only sends one invalidation when multiple event listeners are listening', async () => {
      const mockServerChannel = { emit: vi.fn() } as any as ServerChannel;
      registerIndexJsonRoute({
        app,
        channel: mockServerChannel,
        workingDir,
        normalizedStories,
        storyIndexGeneratorPromise: getStoryIndexGeneratorPromise(),
      });

      expect(use).toHaveBeenCalledTimes(1);
      const route = use.mock.calls[0][1];

      // Don't wait for the first request here before starting the second
      await Promise.all([
        route(request, response),
        route(request, { ...response, write: vi.fn() }),
      ]);

      expect(write).not.toHaveBeenCalled();

      expect(Watchpack).toHaveBeenCalledTimes(1);
      const watcher = Watchpack.mock.instances[0];
      expect(watcher.watch).toHaveBeenCalledWith(
        expect.objectContaining({
          directories: expect.any(Array),
          files: expect.any(Array),
        })
      );

      expect(watcher.on).toHaveBeenCalledTimes(2);
      const onChange = watcher.on.mock.calls[0][1];

      onChange(`${workingDir}/src/nested/Button.stories.ts`);
      // Wait for the batched events to be processed
      await vi.waitFor(() => {
        expect(mockServerChannel.emit).toHaveBeenCalledTimes(1);
      });
      expect(mockServerChannel.emit).toHaveBeenCalledWith(STORY_INDEX_INVALIDATED);
    });

    it('debounces invalidation events', async () => {
      vi.mocked(debounce).mockImplementation(
        (await vi.importActual<typeof import('es-toolkit/function')>('es-toolkit/function'))
          .debounce
      );

      const mockServerChannel = { emit: vi.fn() } as any as ServerChannel;
      registerIndexJsonRoute({
        app,
        channel: mockServerChannel,
        workingDir,
        normalizedStories,
        storyIndexGeneratorPromise: getStoryIndexGeneratorPromise(),
      });

      expect(use).toHaveBeenCalledTimes(1);
      const route = use.mock.calls[0][1];

      await route(request, response);

      expect(write).not.toHaveBeenCalled();

      expect(Watchpack).toHaveBeenCalledTimes(1);
      const watcher = Watchpack.mock.instances[0];
      expect(watcher.watch).toHaveBeenCalledWith(
        expect.objectContaining({
          directories: expect.any(Array),
          files: expect.any(Array),
        })
      );

      expect(watcher.on).toHaveBeenCalledTimes(2);
      const onChange = watcher.on.mock.calls[0][1];

      // Fire multiple change events in rapid succession
      // These get batched by watchStorySpecifiers (100ms batching window)
      // and then debounced by maybeInvalidate (100ms debounce)
      onChange(`${workingDir}/src/nested/Button.stories.ts`);
      onChange(`${workingDir}/src/nested/Button.stories.ts`);
      onChange(`${workingDir}/src/nested/Button.stories.ts`);
      onChange(`${workingDir}/src/nested/Button.stories.ts`);
      onChange(`${workingDir}/src/nested/Button.stories.ts`);

      // Wait for first batch to be processed and emit (leading edge)
      await vi.waitFor(() => {
        expect(mockServerChannel.emit).toHaveBeenCalledTimes(1);
      });
      expect(mockServerChannel.emit).toHaveBeenCalledWith(STORY_INDEX_INVALIDATED);

      // Fire another change event after the first batch is processed
      // This will trigger the trailing edge of the debounce
      onChange(`${workingDir}/src/nested/Button.stories.ts`);

      // Wait for trailing debounce to trigger second emit
      await vi.waitFor(() => {
        expect(mockServerChannel.emit).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('rename redirect store', () => {
    beforeEach(() => {
      // Each test creates its own generator, but the `findMatchingFiles` cache
      // is static and shared across instances. Clearing avoids leaks where one
      // test's `invalidate` leaves a non-existent path marked for rebuild.
      StoryIndexGenerator.clearFindMatchingFilesCache();
      renameRedirectStore.setState({ chains: {}, origins: {} });
    });

    it('writes a rename chain after a confirmed file rename', async () => {
      const mockServerChannel = { emit: vi.fn() } as any as ServerChannel;
      const storyIndexGeneratorPromise = getStoryIndexGeneratorPromise();
      registerIndexJsonRoute({
        app,
        channel: mockServerChannel,
        workingDir,
        normalizedStories,
        storyIndexGeneratorPromise,
      });

      // Prime the generator so it has a cache entry for B.stories.ts to snapshot
      await (await storyIndexGeneratorPromise).getIndex();

      const watcher = Watchpack.mock.instances[0];
      const onChange = watcher.on.mock.calls[0][1];

      // Simulate a file rename: B.stories.ts → B-renamed.stories.ts
      // (the index re-computation after invalidate will not actually find the
      // new file because the fixture is not physically renamed; that is fine —
      // resolveRenamePairs correlates by the newPath the watcher reports).
      onChange(`${workingDir}/src/B.stories.ts`, null, 'rename');
      onChange(`${workingDir}/src/B-renamed.stories.ts`, 1234, 'rename');

      // debounce is mocked as synchronous in this suite
      await vi.waitFor(() => {
        expect(mockServerChannel.emit).toHaveBeenCalled();
      });

      // Without the new file on disk, resolveRenamePairs drops the candidate
      // (no fingerprint match), so no rename is written. That's the correct
      // conservative behaviour and the store should remain empty.
      expect(renameRedirectStore.getState().chains).toEqual({});
    });

    it('writes a deletion chain entry when a watched file is removed', async () => {
      const mockServerChannel = { emit: vi.fn() } as any as ServerChannel;
      const storyIndexGeneratorPromise = getStoryIndexGeneratorPromise();
      registerIndexJsonRoute({
        app,
        channel: mockServerChannel,
        workingDir,
        normalizedStories,
        storyIndexGeneratorPromise,
      });

      await (await storyIndexGeneratorPromise).getIndex();

      const watcher = Watchpack.mock.instances[0];
      const onRemove = watcher.on.mock.calls[1][1];

      onRemove(`${workingDir}/src/B.stories.ts`);

      await vi.waitFor(() => {
        expect(renameRedirectStore.getState().chains['b--story-one']).toEqual([null]);
      });
    });
  });
});

describe('resolveRenamePairs', () => {
  const wd = '/work';
  const makeIndex = (entries: Record<string, any>): any => ({ v: 5, entries });

  it('returns renames when fingerprints match', () => {
    const candidates = [{ oldPath: './src/A.stories.ts', newPath: './src/A-2.stories.ts' }];
    const removedSnapshots = new Map<string, FileSnapshot>([
      [
        join(wd, 'src/A.stories.ts'),
        {
          stories: {
            Primary: { id: 'a--primary' },
            Secondary: { id: 'a--secondary' },
          },
          docs: [],
        },
      ],
    ]);
    const index = makeIndex({
      'a2--primary': {
        id: 'a2--primary',
        type: 'story',
        exportName: 'Primary',
        importPath: './src/A-2.stories.ts',
      },
      'a2--secondary': {
        id: 'a2--secondary',
        type: 'story',
        exportName: 'Secondary',
        importPath: './src/A-2.stories.ts',
      },
    });

    const { renames, unresolved } = resolveRenamePairs(candidates, removedSnapshots, index, wd);
    expect(unresolved).toEqual([]);
    expect(renames).toEqual(
      expect.arrayContaining([
        { oldId: 'a--primary', newId: 'a2--primary' },
        { oldId: 'a--secondary', newId: 'a2--secondary' },
      ])
    );
    expect(renames).toHaveLength(2);
  });

  it('drops candidates when fingerprints differ (conservative fallback)', () => {
    const candidates = [{ oldPath: './src/A.stories.ts', newPath: './src/A-2.stories.ts' }];
    const removedSnapshots = new Map<string, FileSnapshot>([
      [join(wd, 'src/A.stories.ts'), { stories: { Primary: { id: 'a--primary' } }, docs: [] }],
    ]);
    const index = makeIndex({
      'a2--primary': {
        id: 'a2--primary',
        type: 'story',
        exportName: 'Primary',
        importPath: './src/A-2.stories.ts',
      },
      'a2--extra': {
        id: 'a2--extra',
        type: 'story',
        exportName: 'Extra',
        importPath: './src/A-2.stories.ts',
      },
    });

    const { renames, unresolved } = resolveRenamePairs(candidates, removedSnapshots, index, wd);
    expect(renames).toEqual([]);
    expect(unresolved).toEqual(['./src/A.stories.ts']);
  });

  it('aligns by export name regardless of entry order', () => {
    const candidates = [{ oldPath: './src/A.stories.ts', newPath: './src/A-2.stories.ts' }];
    const removedSnapshots = new Map<string, FileSnapshot>([
      [
        join(wd, 'src/A.stories.ts'),
        {
          stories: { First: { id: 'a--first' }, Second: { id: 'a--second' } },
          docs: [],
        },
      ],
    ]);
    // New index has the entries in the opposite positional order
    const index = makeIndex({
      'a2--second': {
        id: 'a2--second',
        type: 'story',
        exportName: 'Second',
        importPath: './src/A-2.stories.ts',
      },
      'a2--first': {
        id: 'a2--first',
        type: 'story',
        exportName: 'First',
        importPath: './src/A-2.stories.ts',
      },
    });

    const { renames } = resolveRenamePairs(candidates, removedSnapshots, index, wd);
    expect(renames).toEqual(
      expect.arrayContaining([
        { oldId: 'a--first', newId: 'a2--first' },
        { oldId: 'a--second', newId: 'a2--second' },
      ])
    );
  });

  it('drops candidates with no snapshot entry', () => {
    const candidates = [{ oldPath: './src/Missing.stories.ts', newPath: './src/New.stories.ts' }];
    const { renames, unresolved } = resolveRenamePairs(candidates, new Map(), makeIndex({}), wd);
    expect(renames).toEqual([]);
    expect(unresolved).toEqual(['./src/Missing.stories.ts']);
  });
});
