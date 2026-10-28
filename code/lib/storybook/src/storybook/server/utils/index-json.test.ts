import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizeStoriesEntry } from '@storybook/core/internal/common';
import { STORY_INDEX_INVALIDATED } from '@storybook/core/internal/core-events';

import { debounce } from 'es-toolkit/function';
import type { Polka, Request, Response } from 'polka';
import Watchpack from 'watchpack';

import { logger } from '@storybook/core/internal/node-logger';
import type { StoryIndex } from '@storybook/core/internal/types';

import { createHookRuntime } from '../../../../../../core/src/instance/hooks.ts';
import { csfIndexer } from '../presets/common-defaults.ts';
import type { StoryIndexGeneratorOptions } from '../../../../../../core/src/story-index/StoryIndexGenerator.ts';
import { StoryIndexGenerator } from '@storybook/core/internal/story-index';
import type { ServerChannel } from './get-server-channel.ts';
import { registerIndexJsonRoute } from './index-json.ts';

vi.mock('watchpack');
vi.mock('es-toolkit/function', { spy: true });
vi.mock('@storybook/core/internal/node-logger');

vi.mock('@storybook/core/internal/deep/common/utils/constants', () => {
  return {
    defaultStaticDirs: [{ from: './from', to: './to' }],
    defaultFavicon: './favicon.svg',
  };
});

const workingDir = join(__dirname, '../../../../../../core/src/story-index/__mockdata__');
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
    vi.mocked(debounce).mockImplementation((cb) => Object.assign(cb, { cancel: vi.fn() }) as any);
    Watchpack.mockClear();
  });

  const request: Request = {
    headers: { accept: 'application/json' },
  } as any;

  it('closes both watchers and cancels pending story and config invalidations', async () => {
    vi.mocked(debounce).mockImplementation(
      (await vi.importActual<typeof import('es-toolkit/function')>('es-toolkit/function')).debounce
    );
    vi.useFakeTimers();
    try {
      const channel = { emit: vi.fn() } as any as ServerChannel;
      const generator = { invalidate: vi.fn(), invalidateAll: vi.fn() };
      const dispose = registerIndexJsonRoute({
        app,
        channel,
        workingDir,
        configDir: workingDir,
        normalizedStories,
        storyIndexGeneratorPromise: Promise.resolve(generator as unknown as StoryIndexGenerator),
      });
      expect(Watchpack).toHaveBeenCalledTimes(2);
      const [storiesWatcher, configWatcher] = Watchpack.mock.instances;
      const onStoryChange = storiesWatcher.on.mock.calls[0][1];
      const onConfigChange = configWatcher.on.mock.calls[2][1];
      onStoryChange(`${workingDir}/src/nested/Button.stories.ts`);
      await onConfigChange(`${workingDir}/preview.ts`, new Date());
      await onConfigChange(`${workingDir}/preview.ts`, new Date());
      expect(channel.emit).toHaveBeenCalledOnce();
      dispose();
      expect(storiesWatcher.close).toHaveBeenCalledOnce();
      expect(configWatcher.close).toHaveBeenCalledOnce();
      await vi.runAllTimersAsync();
      expect(channel.emit).toHaveBeenCalledOnce();
      expect(generator.invalidate).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('discards invalidations awaiting the generator when disposed', async () => {
    vi.mocked(debounce).mockImplementation(
      (await vi.importActual<typeof import('es-toolkit/function')>('es-toolkit/function')).debounce
    );
    vi.useFakeTimers();
    try {
      const channel = { emit: vi.fn() } as any as ServerChannel;
      const generator = { invalidate: vi.fn(), invalidateAll: vi.fn() };
      const pending = Promise.withResolvers<StoryIndexGenerator>();
      const dispose = registerIndexJsonRoute({
        app,
        channel,
        workingDir,
        configDir: workingDir,
        normalizedStories,
        storyIndexGeneratorPromise: pending.promise,
      });
      const [storiesWatcher, configWatcher] = Watchpack.mock.instances;
      const onStoryChange = storiesWatcher.on.mock.calls[0][1];
      const onConfigChange = configWatcher.on.mock.calls[2][1];
      onStoryChange(`${workingDir}/src/nested/Button.stories.ts`, new Date());
      await vi.advanceTimersByTimeAsync(100);
      const configChange = onConfigChange(`${workingDir}/preview.ts`, new Date());
      dispose();
      pending.resolve(generator as unknown as StoryIndexGenerator);
      await configChange;
      await vi.runAllTimersAsync();

      expect({
        storyInvalidations: generator.invalidate.mock.calls.length,
        configInvalidations: generator.invalidateAll.mock.calls.length,
        events: vi.mocked(channel.emit).mock.calls.length,
      }).toMatchInlineSnapshot(`
        {
          "configInvalidations": 0,
          "events": 0,
          "storyInvalidations": 0,
        }
      `);
    } finally {
      vi.useRealTimers();
    }
  });

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

      onChange(`${workingDir}/src/nested/Button.stories.ts`);
      // Wait for the batched events to be processed
      await vi.waitFor(() => {
        expect(mockServerChannel.emit).toHaveBeenCalledTimes(1);
      });
      expect(mockServerChannel.emit).toHaveBeenCalledWith(STORY_INDEX_INVALIDATED);
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

  describe('index:invalidated:after', () => {
    it.each([
      {
        name: 'a listener, after a story file changes',
        mtime: new Date(),
        throws: false,
        expected: { notified: 1, isNew: true, hasButton: true, warnings: 0 },
      },
      {
        name: 'a listener, after a story file is removed',
        mtime: undefined,
        throws: false,
        expected: { notified: 1, isNew: true, hasButton: false, warnings: 0 },
      },
      {
        name: 'a throwing listener, logging its error',
        mtime: new Date(),
        throws: true,
        expected: { notified: 1, isNew: true, hasButton: true, warnings: 1 },
      },
    ])('hands $name the regenerated index once', async ({ mtime, throws, expected }) => {
      vi.mocked(logger.warn).mockClear();
      const hooks = createHookRuntime();
      const seen: StoryIndex[] = [];
      hooks.hook(
        'index:invalidated:after',
        (index) => {
          seen.push(index);
          if (throws) {
            throw new Error('listener failed');
          }
        },
        'notify'
      );
      const storyIndexGeneratorPromise = getStoryIndexGeneratorPromise();
      registerIndexJsonRoute({
        app,
        channel: { emit: vi.fn() } as any as ServerChannel,
        workingDir,
        normalizedStories,
        storyIndexGeneratorPromise,
        onRegenerated: (index) => hooks.callHook('index:invalidated:after', index),
      });
      const generator = await storyIndexGeneratorPromise;
      const before = await generator.getIndex();

      const onChange = Watchpack.mock.instances[0].on.mock.calls[0][1];
      onChange(`${workingDir}/src/nested/Button.stories.ts`, mtime);
      await vi.waitFor(() => expect(seen).toHaveLength(1));
      await vi.waitFor(() => expect(logger.warn).toHaveBeenCalledTimes(expected.warnings));

      expect({
        notified: seen.length,
        isNew: seen[0] !== before && seen[0] === (await generator.getIndex()),
        hasButton: 'nested-button--story-one' in seen[0].entries,
        warnings: vi.mocked(logger.warn).mock.calls.length,
      }).toEqual(expected);
    });
  });
});
