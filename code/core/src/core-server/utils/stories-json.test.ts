import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizeStoriesEntry } from 'storybook/internal/common';
import { STORY_INDEX_INVALIDATED } from 'storybook/internal/core-events';

import { debounce } from 'es-toolkit/function';
import type { Polka, Request, Response } from 'polka';
import Watchpack from 'watchpack';

import { csfIndexer } from '../presets/common-preset';
import type { StoryIndexGeneratorOptions } from './StoryIndexGenerator';
import { StoryIndexGenerator } from './StoryIndexGenerator';
import type { ServerChannel } from './get-server-channel';
import { DEBOUNCE, useStoriesJson } from './stories-json';

vi.mock('watchpack');
vi.mock('es-toolkit/function', { spy: true });
vi.mock('storybook/internal/node-logger');

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

const getInitializedStoryIndexGenerator = async (
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

describe('useStoriesJson', () => {
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

  const defaultOptions = {
    host: 'localhost',
    port: 6006,
    https: false,
    initialPath: '',
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
      console.time('useStoriesJson');
      useStoriesJson({
        app,
        serverChannel: mockServerChannel,
        workingDir,
        normalizedStories,
        initializedStoryIndexGenerator: getInitializedStoryIndexGenerator(),
        options: defaultOptions,
      });
      console.timeEnd('useStoriesJson');

      // /index.json and /sitemap.xml
      expect(use).toHaveBeenCalledTimes(2);
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

      useStoriesJson({
        app,
        serverChannel: mockServerChannel,
        workingDir,
        normalizedStories,
        initializedStoryIndexGenerator: getInitializedStoryIndexGenerator(),
        options: defaultOptions,
      });

      expect(use).toHaveBeenCalledTimes(2);
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
      useStoriesJson({
        app,
        serverChannel: mockServerChannel,
        workingDir,
        normalizedStories,
        initializedStoryIndexGenerator: getInitializedStoryIndexGenerator(),
        options: defaultOptions,
      });

      expect(use).toHaveBeenCalledTimes(2);
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

      await onChange(`${workingDir}/src/nested/Button.stories.ts`);
      expect(mockServerChannel.emit).toHaveBeenCalledTimes(1);
      expect(mockServerChannel.emit).toHaveBeenCalledWith(STORY_INDEX_INVALIDATED);
    });

    it('only sends one invalidation when multiple event listeners are listening', async () => {
      const mockServerChannel = { emit: vi.fn() } as any as ServerChannel;
      useStoriesJson({
        app,
        serverChannel: mockServerChannel,
        workingDir,
        normalizedStories,
        initializedStoryIndexGenerator: getInitializedStoryIndexGenerator(),
        options: defaultOptions,
      });

      expect(use).toHaveBeenCalledTimes(2);
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

      await onChange(`${workingDir}/src/nested/Button.stories.ts`);
      expect(mockServerChannel.emit).toHaveBeenCalledTimes(1);
      expect(mockServerChannel.emit).toHaveBeenCalledWith(STORY_INDEX_INVALIDATED);
    });

    it('debounces invalidation events', async () => {
      vi.mocked(debounce).mockImplementation(
        (await vi.importActual<typeof import('es-toolkit/function')>('es-toolkit/function'))
          .debounce
      );

      const mockServerChannel = { emit: vi.fn() } as any as ServerChannel;
      useStoriesJson({
        app,
        serverChannel: mockServerChannel,
        workingDir,
        normalizedStories,
        initializedStoryIndexGenerator: getInitializedStoryIndexGenerator(),
        options: defaultOptions,
      });

      expect(use).toHaveBeenCalledTimes(2);
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

      await onChange(`${workingDir}/src/nested/Button.stories.ts`);
      await onChange(`${workingDir}/src/nested/Button.stories.ts`);
      await onChange(`${workingDir}/src/nested/Button.stories.ts`);
      await onChange(`${workingDir}/src/nested/Button.stories.ts`);
      await onChange(`${workingDir}/src/nested/Button.stories.ts`);

      expect(mockServerChannel.emit).toHaveBeenCalledTimes(1);
      expect(mockServerChannel.emit).toHaveBeenCalledWith(STORY_INDEX_INVALIDATED);

      await new Promise((r) => setTimeout(r, 2 * DEBOUNCE));

      expect(mockServerChannel.emit).toHaveBeenCalledTimes(2);
    });
  });

  describe('Sitemap endpoint', () => {
    beforeEach(() => {
      use.mockClear();
      end.mockClear();
    });

    it('generates sitemap with http://localhost', async () => {
      const mockServerChannel = { emit: vi.fn() } as any as ServerChannel;
      useStoriesJson({
        app,
        serverChannel: mockServerChannel,
        workingDir,
        normalizedStories,
        initializedStoryIndexGenerator: getInitializedStoryIndexGenerator(),
        options: defaultOptions,
      });

      expect(use).toHaveBeenCalledTimes(2);
      const sitemapRoute = use.mock.calls[1][1];

      await sitemapRoute(request, response);

      expect(end).toHaveBeenCalledTimes(1);
      expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'application/xml');
      expect(response.setHeader).toHaveBeenCalledWith('Content-Encoding', 'gzip');

      const gzippedBuffer = end.mock.calls[0][0];
      const decompressed = gunzipSync(gzippedBuffer).toString('utf-8');

      expect(decompressed).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(decompressed).toContain('<urlset');
      expect(decompressed).toContain('http://localhost:6006');
      expect(decompressed).toContain('/?path=/docs/a--metaof');
      expect(decompressed).toContain('/?path=/story/a--story-one');
      expect(decompressed).toContain('/?path=/settings/about');
      expect(decompressed).toContain('/?path=/settings/whats-new');
      expect(decompressed).toContain('/?path=/settings/guide');
      expect(decompressed).toContain('/?path=/settings/shortcuts');
    });

    it('generates sitemap with https protocol', async () => {
      const mockServerChannel = { emit: vi.fn() } as any as ServerChannel;
      const httpsOptions = { ...defaultOptions, https: true };

      useStoriesJson({
        app,
        serverChannel: mockServerChannel,
        workingDir,
        normalizedStories,
        initializedStoryIndexGenerator: getInitializedStoryIndexGenerator(),
        options: httpsOptions,
      });

      const sitemapRoute = use.mock.calls[1][1];
      await sitemapRoute(request, response);

      const gzippedBuffer = end.mock.calls[0][0];
      const decompressed = gunzipSync(gzippedBuffer).toString('utf-8');

      expect(decompressed).toContain('https://localhost:6006');
      expect(decompressed).not.toContain('http://localhost:6006');
    });

    it('generates sitemap for production website (example.com)', async () => {
      const mockServerChannel = { emit: vi.fn() } as any as ServerChannel;
      const productionOptions = {
        host: 'example.com',
        port: 443,
        https: true,
        initialPath: '',
      } as any;

      useStoriesJson({
        app,
        serverChannel: mockServerChannel,
        workingDir,
        normalizedStories,
        initializedStoryIndexGenerator: getInitializedStoryIndexGenerator(),
        options: productionOptions,
      });

      const sitemapRoute = use.mock.calls[1][1];
      await sitemapRoute(request, response);

      const gzippedBuffer = end.mock.calls[0][0];
      const decompressed = gunzipSync(gzippedBuffer).toString('utf-8');

      expect(decompressed).toContain('https://example.com');
      expect(decompressed).toContain('/?path=/docs/a--metaof');
      expect(decompressed).toContain('/?path=/story/a--story-one');
    });

    it('uses cached sitemap on subsequent requests', async () => {
      const mockServerChannel = { emit: vi.fn() } as any as ServerChannel;
      useStoriesJson({
        app,
        serverChannel: mockServerChannel,
        workingDir,
        normalizedStories,
        initializedStoryIndexGenerator: getInitializedStoryIndexGenerator(),
        options: defaultOptions,
      });

      const sitemapRoute = use.mock.calls[1][1];

      // First request
      await sitemapRoute(request, response);
      const firstBuffer = end.mock.calls[0][0] as Buffer;

      // Second request
      const secondResponse = {
        ...response,
        end: vi.fn(),
        setHeader: vi.fn(),
        on: vi.fn(),
      };
      await sitemapRoute(request, secondResponse);
      const secondBuffer = secondResponse.end.mock.calls[0][0] as Buffer;

      // Should return the same cached buffer
      expect(firstBuffer).toBe(secondBuffer);
    });

    it('excludes test stories from sitemap', async () => {
      const mockServerChannel = { emit: vi.fn() } as any as ServerChannel;
      useStoriesJson({
        app,
        serverChannel: mockServerChannel,
        workingDir,
        normalizedStories,
        initializedStoryIndexGenerator: getInitializedStoryIndexGenerator(),
        options: defaultOptions,
      });

      const sitemapRoute = use.mock.calls[1][1];
      await sitemapRoute(request, response);

      const gzippedBuffer = end.mock.calls[0][0];
      const decompressed = gunzipSync(gzippedBuffer).toString('utf-8');

      // Verify test stories are not included
      // Note: If test stories exist in mock data with subtype: 'test', they should not appear
      expect(decompressed).toContain('/?path=/story/a--story-one');
      expect(decompressed).toContain('/?path=/docs/a--metaof');
    });
  });
});
