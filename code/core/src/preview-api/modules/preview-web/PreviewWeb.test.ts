// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ModuleImportFn, ProjectAnnotations, Renderer } from '@storybook/core/types';
import { global } from '@storybook/global';

import { logger } from '@storybook/core/client-logger';
import {
  CONFIG_ERROR,
  CURRENT_STORY_WAS_SET,
  DOCS_PREPARED,
  DOCS_RENDERED,
  FORCE_REMOUNT,
  FORCE_RE_RENDER,
  GLOBALS_UPDATED,
  PLAY_FUNCTION_THREW_EXCEPTION,
  PREVIEW_KEYDOWN,
  RESET_STORY_ARGS,
  SET_CURRENT_STORY,
  SET_GLOBALS,
  STORY_ARGS_UPDATED,
  STORY_CHANGED,
  STORY_ERRORED,
  STORY_MISSING,
  STORY_PREPARED,
  STORY_RENDERED,
  STORY_SPECIFIED,
  STORY_THREW_EXCEPTION,
  STORY_UNCHANGED,
  UPDATE_GLOBALS,
  UPDATE_STORY_ARGS,
} from '@storybook/core/core-events';

import { merge, toMerged } from 'es-toolkit';

import { addons } from '../addons';
import type { StoryStore } from '../store';
import { PreviewWeb } from './PreviewWeb';
import {
  componentOneExports,
  componentTwoExports,
  docsRenderer,
  emitter,
  getProjectAnnotations,
  importFn,
  mockChannel,
  projectAnnotations,
  storyIndex,
  teardownrenderToCanvas,
  unattachedDocsExports,
  waitForEvents,
  waitForQuiescence,
  waitForRender,
  waitForRenderPhase,
} from './PreviewWeb.mockdata';
import { WebView } from './WebView';

const { history, document } = global;

const mockStoryIndex = vi.fn(() => storyIndex);

let mockFetchResult: any;
vi.mock('@storybook/global', async (importOriginal) => ({
  global: {
    ...(await importOriginal<typeof import('@storybook/global')>),
    history: { replaceState: vi.fn() },
    document: {
      location: {
        pathname: 'pathname',
        search: '?id=*',
      },
    },
    fetch: async () => mockFetchResult,
  },
}));

vi.mock('@storybook/core/client-logger');
vi.mock('react-dom');
vi.mock('./WebView');

const serializeError = (error: Error) => {
  const { name = 'Error', message = String(error), stack } = error;
  return { name, message, stack };
};

const createGate = (): [Promise<any | undefined>, (_?: any) => void] => {
  let openGate = (_?: any) => {};
  const gate = new Promise<any | undefined>((resolve) => {
    openGate = resolve;
  });
  return [gate, openGate];
};

async function waitForSetCurrentStory() {
  await vi.waitFor(() => {
    expect(mockChannel.emit).toHaveBeenCalledWith(CURRENT_STORY_WAS_SET, expect.anything());
  });
}

async function createAndRenderPreview({
  importFn: inputImportFn = importFn,
  getProjectAnnotations: inputGetProjectAnnotations = getProjectAnnotations,
}: {
  importFn?: ModuleImportFn;
  getProjectAnnotations?: () => ProjectAnnotations<Renderer>;
} = {}) {
  const preview = new PreviewWeb(inputImportFn, inputGetProjectAnnotations);
  await preview.ready();
  await waitForRender();

  return preview;
}

beforeEach(() => {
  document.location.search = '';
  mockChannel.emit.mockClear();
  emitter.removeAllListeners();
  componentOneExports.default.loaders[0].mockReset().mockImplementation(async () => ({ l: 7 }));
  componentOneExports.a.play.mockReset();
  teardownrenderToCanvas.mockReset();
  projectAnnotations.renderToCanvas.mockReset().mockReturnValue(teardownrenderToCanvas);
  projectAnnotations.render.mockClear();
  projectAnnotations.decorators[0].mockClear();
  docsRenderer.render.mockClear();
  vi.mocked(logger.warn).mockClear();

  vi.mocked(console.error).mockReset();

  mockStoryIndex.mockReset().mockReturnValue(storyIndex);

  addons.setChannel(mockChannel as any);
  mockFetchResult = { status: 200, json: mockStoryIndex, text: () => 'error text' };

  vi.mocked(WebView.prototype).prepareForDocs.mockReturnValue('docs-element' as any);
  vi.mocked(WebView.prototype).prepareForStory.mockReturnValue('story-element' as any);
});

describe('PreviewWeb', () => {
  describe('ready', () => {
    it('shows an error if getProjectAnnotations throws', async () => {
      const err = new Error('meta error');
      const preview = new PreviewWeb(importFn, () => {
        throw err;
      });
      await expect(preview.ready()).rejects.toThrow(err);

      expect(preview.view.showErrorDisplay).toHaveBeenCalled();
      expect(mockChannel.emit).toHaveBeenCalledWith(CONFIG_ERROR, err);
    });

    it('shows an error if the stories.json endpoint 500s', async () => {
      const err = new Error('sort error');
      mockFetchResult = { status: 500, text: async () => err.toString() };

      const preview = new PreviewWeb(importFn, getProjectAnnotations);
      await expect(preview.ready()).rejects.toThrow('sort error');

      expect(preview.view.showErrorDisplay).toHaveBeenCalled();
      expect(mockChannel.emit).toHaveBeenCalledWith(CONFIG_ERROR, expect.any(Error));
    });

    it('sets globals from the URL', async () => {
      document.location.search = '?id=*&globals=a:c';

      const preview = await createAndRenderPreview();

      expect((preview.storyStore as StoryStore<Renderer>)!.userGlobals.get()).toEqual({ a: 'c' });
    });

    it('emits the SET_GLOBALS event', async () => {
      await createAndRenderPreview();

      expect(mockChannel.emit.mock.calls[0][1]).toMatchObject({
        globals: { a: 'b' },
        globalTypes: {},
      });

      expect(mockChannel.emit).toHaveBeenCalledWith(SET_GLOBALS, {
        globals: { a: 'b' },
        globalTypes: {},
      });
    });

    it('SET_GLOBALS sets globals and types even when undefined', async () => {
      await createAndRenderPreview({
        getProjectAnnotations: () => ({ renderToCanvas: vi.fn() }),
      });

      expect(mockChannel.emit).toHaveBeenCalledWith(SET_GLOBALS, {
        globals: {},
        globalTypes: {},
      });
    });

    it('emits the SET_GLOBALS event from the URL', async () => {
      document.location.search = '?id=*&globals=a:c';

      await createAndRenderPreview();

      expect(mockChannel.emit).toHaveBeenCalledWith(SET_GLOBALS, {
        globals: { a: 'c' },
        globalTypes: {},
      });
    });

    it('sets args from the URL', async () => {
      document.location.search = '?id=component-one--a&args=foo:url';

      const preview = await createAndRenderPreview();

      expect((preview.storyStore as StoryStore<Renderer>)?.args.get('component-one--a')).toEqual({
        foo: 'url',
        one: 1,
      });
    });

    it('prepares story with args from the URL', async () => {
      document.location.search = '?id=component-one--a&args=foo:url';

      await createAndRenderPreview();

      expect(mockChannel.emit).toHaveBeenCalledWith(
        STORY_PREPARED,
        expect.objectContaining({
          id: 'component-one--a',
          args: { foo: 'url', one: 1 },
        })
      );
    });

    it('allows async getProjectAnnotations', async () => {
      const preview = new PreviewWeb(importFn, async () => {
        return getProjectAnnotations();
      });
      await preview.ready();

      expect((preview.storyStore as StoryStore<Renderer>)!.userGlobals.get()).toEqual({ a: 'b' });
    });
  });

  describe('initial selection', () => {
    it('selects the story specified in the URL', async () => {
      document.location.search = '?id=component-one--a';

      const preview = await createAndRenderPreview();

      expect(preview.selectionStore.selection).toEqual({
        storyId: 'component-one--a',
        viewMode: 'story',
      });
      expect(history.replaceState).toHaveBeenCalledWith(
        {},
        '',
        'pathname?id=component-one--a&viewMode=story'
      );
    });

    it('emits the STORY_SPECIFIED event', async () => {
      document.location.search = '?id=component-one--a';

      await createAndRenderPreview();

      expect(mockChannel.emit).toHaveBeenCalledWith(STORY_SPECIFIED, {
        storyId: 'component-one--a',
        viewMode: 'story',
      });
    });

    it('emits the CURRENT_STORY_WAS_SET event', async () => {
      document.location.search = '?id=component-one--a';

      await createAndRenderPreview();

      expect(mockChannel.emit).toHaveBeenCalledWith(CURRENT_STORY_WAS_SET, {
        storyId: 'component-one--a',
        viewMode: 'story',
      });
    });

    describe('when the first entry is a docs entry', () => {
      it('emits the STORY_SPECIFIED event with viewMode=docs', async () => {
        document.location.search = '?id=*';
        await createAndRenderPreview();

        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_SPECIFIED, {
          storyId: 'component-one--docs',
          viewMode: 'docs',
        });
      });
    });

    describe('if the story specified does not exist', () => {
      it('renders a loading error', async () => {
        document.location.search = '?id=random';

        const preview = await createAndRenderPreview();

        expect(preview.view.showErrorDisplay).toHaveBeenCalled();
        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_MISSING, 'random');
      });

      it('tries again with a specifier if CSF file changes', async () => {
        document.location.search = '?id=component-one--missing';

        const preview = await createAndRenderPreview();

        expect(preview.view.showErrorDisplay).toHaveBeenCalled();
        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_MISSING, 'component-one--missing');

        mockChannel.emit.mockClear();
        const newComponentOneExports = toMerged(componentOneExports, {
          d: { args: { foo: 'd' }, play: vi.fn() },
        });
        const newImportFn = vi.fn(async (path) => {
          return path === './src/ComponentOne.stories.js'
            ? newComponentOneExports
            : componentTwoExports;
        });
        preview.onStoriesChanged({
          importFn: newImportFn,
          storyIndex: {
            v: 5,
            entries: {
              ...storyIndex.entries,
              'component-one--missing': {
                type: 'story',
                id: 'component-one--missing',
                title: 'Component One',
                name: 'D',
                importPath: './src/ComponentOne.stories.js',
              },
            },
          },
        });
        await waitForRender();

        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_SPECIFIED, {
          storyId: 'component-one--missing',
          viewMode: 'story',
        });
      });

      describe('after selection changes', () => {
        beforeEach(() => {
          vi.useFakeTimers();
        });
        afterEach(() => {
          vi.useRealTimers();
        });

        it('DOES NOT try again if CSF file changes', async () => {
          document.location.search = '?id=component-one--missing';

          const preview = await createAndRenderPreview();

          expect(preview.view.showErrorDisplay).toHaveBeenCalled();
          expect(mockChannel.emit).toHaveBeenCalledWith(STORY_MISSING, 'component-one--missing');

          emitter.emit(SET_CURRENT_STORY, {
            storyId: 'component-one--b',
            viewMode: 'story',
          });
          await waitForSetCurrentStory();

          const newComponentOneExports = toMerged(componentOneExports, {
            d: { args: { foo: 'd' }, play: vi.fn() },
          });
          const newImportFn = vi.fn(async (path) => {
            return path === './src/ComponentOne.stories.js'
              ? newComponentOneExports
              : componentTwoExports;
          });

          preview.onStoriesChanged({
            importFn: newImportFn,
            storyIndex: {
              v: 5,
              entries: {
                ...storyIndex.entries,
                'component-one--missing': {
                  type: 'story',
                  id: 'component-one--missing',
                  title: 'Component One',
                  name: 'D',
                  importPath: './src/ComponentOne.stories.js',
                },
              },
            },
          });
          expect(mockChannel.emit).not.toHaveBeenCalledWith(STORY_SPECIFIED, {
            storyId: 'component-one--missing',
            viewMode: 'story',
          });
        });
      });
    });

    it('renders missing if no selection', async () => {
      const preview = await createAndRenderPreview();

      expect(preview.view.showNoPreview).toHaveBeenCalled();
      expect(mockChannel.emit).toHaveBeenCalledWith(STORY_MISSING);
    });

    describe('story entries', () => {
      it('calls view.prepareForStory', async () => {
        document.location.search = '?id=component-one--a';

        const preview = await createAndRenderPreview();

        expect(preview.view.prepareForStory).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'component-one--a',
          })
        );
      });

      it('emits STORY_PREPARED', async () => {
        document.location.search = '?id=component-one--a';
        await createAndRenderPreview();

        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_PREPARED, {
          id: 'component-one--a',
          parameters: {
            __isArgsStory: false,
            docs: expect.any(Object),
            fileName: './src/ComponentOne.stories.js',
          },
          initialArgs: { foo: 'a', one: 1 },
          argTypes: {
            foo: { name: 'foo', type: { name: 'string' } },
            one: { name: 'one', type: { name: 'string' }, mapping: { 1: 'mapped-1' } },
          },
          args: { foo: 'a', one: 1 },
        });
      });

      it('emits GLOBALS_UPDATED with initial global values', async () => {
        document.location.search = '?id=component-one--a';
        await createAndRenderPreview();

        await waitForEvents([GLOBALS_UPDATED]);
        expect(mockChannel.emit).toHaveBeenCalledWith(GLOBALS_UPDATED, {
          initialGlobals: { a: 'b' },
          userGlobals: { a: 'b' },
          storyGlobals: {},
          globals: { a: 'b' },
        });
      });

      describe('if the story sets globals', () => {
        it('emits GLOBALS_UPDATED with overridden storyGlobals', async () => {
          document.location.search = '?id=component-one--a';
          const newImportFn = vi.fn(async (path) => {
            if (path === './src/ComponentOne.stories.js') {
              return {
                ...componentOneExports,
                a: { ...componentOneExports.a, globals: { a: 'c' } },
              };
            }
            return importFn(path);
          });
          await createAndRenderPreview({ importFn: newImportFn });

          await waitForEvents([GLOBALS_UPDATED]);
          expect(mockChannel.emit).toHaveBeenCalledWith(GLOBALS_UPDATED, {
            initialGlobals: { a: 'b' },
            userGlobals: { a: 'b' },
            storyGlobals: { a: 'c' },
            globals: { a: 'c' },
          });
        });
      });

      it('applies loaders with story context', async () => {
        document.location.search = '?id=component-one--a';
        await createAndRenderPreview();

        expect(componentOneExports.default.loaders[0]).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'component-one--a',
            parameters: {
              __isArgsStory: false,
              docs: expect.any(Object),
              fileName: './src/ComponentOne.stories.js',
            },
            initialArgs: { foo: 'a', one: 1 },
            argTypes: {
              foo: { name: 'foo', type: { name: 'string' } },
              one: { name: 'one', type: { name: 'string' }, mapping: { 1: 'mapped-1' } },
            },
            args: { foo: 'a', one: 'mapped-1' },
          })
        );
      });

      it('passes loaded context to renderToCanvas', async () => {
        document.location.search = '?id=component-one--a';
        await createAndRenderPreview();

        expect(projectAnnotations.renderToCanvas).toHaveBeenCalledWith(
          expect.objectContaining({
            forceRemount: true,
            storyContext: expect.objectContaining({
              id: 'component-one--a',
              parameters: {
                __isArgsStory: false,
                docs: expect.any(Object),
                fileName: './src/ComponentOne.stories.js',
              },
              globals: { a: 'b' },
              initialArgs: { foo: 'a', one: 1 },
              argTypes: {
                foo: { name: 'foo', type: { name: 'string' } },
                one: { name: 'one', type: { name: 'string' }, mapping: { 1: 'mapped-1' } },
              },
              args: { foo: 'a', one: 'mapped-1' },
              loaded: { l: 7 },
            }),
          }),
          'story-element'
        );
      });

      it('renders exception if a loader throws', async () => {
        const error = new Error('error');
        componentOneExports.default.loaders[0].mockImplementationOnce(() => {
          throw error;
        });

        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();

        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_THREW_EXCEPTION, serializeError(error));
        expect(preview.view.showErrorDisplay).toHaveBeenCalledWith(error);
      });

      it('renders exception if renderToCanvas throws', async () => {
        const error = new Error('error');
        projectAnnotations.renderToCanvas.mockImplementation(() => {
          throw error;
        });

        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();

        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_THREW_EXCEPTION, serializeError(error));
        expect(preview.view.showErrorDisplay).toHaveBeenCalledWith(error);
      });

      it('renders helpful message if renderToCanvas is undefined', async () => {
        document.location.search = '?id=component-one--a';

        getProjectAnnotations.mockReturnValueOnce({
          ...projectAnnotations,
          renderToCanvas: undefined,
        });
        const preview = new PreviewWeb(importFn, getProjectAnnotations);
        await expect(preview.ready()).rejects.toThrow();

        expect(preview.view.showErrorDisplay).toHaveBeenCalled();
        expect(vi.mocked(preview.view.showErrorDisplay).mock.calls[0][0]).toMatchInlineSnapshot(`
          [SB_PREVIEW_API_0004 (MissingRenderToCanvasError): Expected your framework's preset to export a \`renderToCanvas\` field.

          Perhaps it needs to be upgraded for Storybook 7.0?

          More info: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#mainjs-framework-field
          ]
        `);
      });

      describe('when `throwPlayFunctionExceptions` is set', () => {
        it('emits but does not render exception if the play function throws', async () => {
          const error = new Error('error');
          componentOneExports.a.play.mockImplementationOnce(() => {
            throw error;
          });

          getProjectAnnotations.mockReturnValueOnce({
            ...projectAnnotations,
            parameters: {
              ...projectAnnotations.parameters,
              throwPlayFunctionExceptions: false,
            },
          });

          document.location.search = '?id=component-one--a';
          const preview = await createAndRenderPreview();

          expect(mockChannel.emit).toHaveBeenCalledWith(
            PLAY_FUNCTION_THREW_EXCEPTION,
            serializeError(error)
          );
          expect(preview.view.showErrorDisplay).not.toHaveBeenCalled();
          expect(mockChannel.emit).not.toHaveBeenCalledWith(
            STORY_THREW_EXCEPTION,
            serializeError(error)
          );
        });
      });

      describe('when `throwPlayFunctionExceptions` is unset', () => {
        it('emits AND renders exception if the play function throws', async () => {
          const error = new Error('error');
          componentOneExports.a.play.mockImplementationOnce(() => {
            throw error;
          });

          document.location.search = '?id=component-one--a';
          const preview = await createAndRenderPreview();

          expect(mockChannel.emit).toHaveBeenCalledWith(
            PLAY_FUNCTION_THREW_EXCEPTION,
            serializeError(error)
          );
          expect(preview.view.showErrorDisplay).toHaveBeenCalled();
          expect(mockChannel.emit).toHaveBeenCalledWith(
            STORY_THREW_EXCEPTION,
            serializeError(error)
          );
        });
      });

      it('renders exception if the story calls showException', async () => {
        const error = new Error('error');
        projectAnnotations.renderToCanvas.mockImplementation((context) =>
          context.showException(error)
        );

        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();

        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_THREW_EXCEPTION, serializeError(error));
        expect(preview.view.showErrorDisplay).toHaveBeenCalledWith(error);
      });

      it('renders error if the story calls showError', async () => {
        const error = { title: 'title', description: 'description' };
        projectAnnotations.renderToCanvas.mockImplementation((context) => context.showError(error));

        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();

        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_ERRORED, error);
        expect(preview.view.showErrorDisplay).toHaveBeenCalledWith({
          message: error.title,
          stack: error.description,
        });
      });

      it('executes playFunction', async () => {
        document.location.search = '?id=component-one--a';
        await createAndRenderPreview();

        expect(componentOneExports.a.play).toHaveBeenCalled();
      });

      it('emits STORY_RENDERED', async () => {
        document.location.search = '?id=component-one--a';
        await createAndRenderPreview();

        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_RENDERED, 'component-one--a');
      });
    });

    describe('CSF docs entries', () => {
      it('emits DOCS_PREPARED', async () => {
        document.location.search = '?id=component-one--docs';
        await createAndRenderPreview();

        expect(mockChannel.emit).toHaveBeenCalledWith(DOCS_PREPARED, {
          id: 'component-one--docs',
          parameters: {
            docs: expect.any(Object),
            fileName: './src/ComponentOne.stories.js',
          },
        });
      });

      it('always renders in docs viewMode', async () => {
        document.location.search = '?id=component-one--docs';
        await createAndRenderPreview();

        expect(mockChannel.emit).toHaveBeenCalledWith(DOCS_RENDERED, 'component-one--docs');
      });

      it('calls view.prepareForDocs', async () => {
        document.location.search = '?id=component-one--docs&viewMode=docs';
        const preview = await createAndRenderPreview();

        expect(preview.view.prepareForDocs).toHaveBeenCalled();
      });

      it('renders with docs parameters from the first story', async () => {
        document.location.search = '?id=component-one--docs&viewMode=docs';
        await createAndRenderPreview();

        expect(docsRenderer.render).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            page: componentOneExports.default.parameters.docs.page,
            renderer: projectAnnotations.parameters.docs.renderer,
          }),
          'docs-element'
        );
      });

      it('loads imports of the docs entry', async () => {
        document.location.search = '?id=component-one--docs&viewMode=docs';
        await createAndRenderPreview();

        expect(importFn).toHaveBeenCalledWith('./src/ExtraComponentOne.stories.js');
      });

      it('renders with componentStories loaded from the attached CSF file', async () => {
        document.location.search = '?id=component-one--docs&viewMode=docs';
        await createAndRenderPreview();

        const context = docsRenderer.render.mock.calls[0][0];

        expect(context.componentStories().map((s: any) => s.id)).toEqual([
          'component-one--a',
          'component-one--b',
          'component-one--e',
        ]);
      });

      it('emits DOCS_RENDERED', async () => {
        document.location.search = '?id=component-one--docs&viewMode=docs';

        await createAndRenderPreview();

        expect(mockChannel.emit).toHaveBeenCalledWith(DOCS_RENDERED, 'component-one--docs');
      });
    });

    describe('MDX docs entries', () => {
      it('always renders in docs viewMode', async () => {
        document.location.search = '?id=introduction--docs';
        await createAndRenderPreview();

        expect(mockChannel.emit).toHaveBeenCalledWith(DOCS_RENDERED, 'introduction--docs');
      });

      it('emits DOCS_PREPARED', async () => {
        document.location.search = '?id=introduction--docs';
        await createAndRenderPreview();

        expect(mockChannel.emit).toHaveBeenCalledWith(DOCS_PREPARED, {
          id: 'introduction--docs',
          parameters: {
            docs: expect.any(Object),
          },
        });
      });

      describe('attached', () => {
        it('emits DOCS_PREPARED with component parameters', async () => {
          document.location.search = '?id=component-one--attached-docs';
          await createAndRenderPreview();

          expect(mockChannel.emit).toHaveBeenCalledWith(DOCS_PREPARED, {
            id: 'component-one--attached-docs',
            parameters: {
              docs: expect.any(Object),
              fileName: './src/ComponentOne.stories.js',
            },
          });
        });
      });

      it('calls view.prepareForDocs', async () => {
        document.location.search = '?id=component-one--docs&viewMode=docs';
        const preview = await createAndRenderPreview();

        expect(preview.view.prepareForDocs).toHaveBeenCalled();
      });

      it('renders with the generated docs parameters', async () => {
        document.location.search = '?id=introduction--docs&viewMode=docs';
        await createAndRenderPreview();

        expect(docsRenderer.render).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            page: unattachedDocsExports.default,
            renderer: projectAnnotations.parameters.docs.renderer,
          }),
          'docs-element'
        );
      });

      it('loads imports of the docs entry', async () => {
        document.location.search = '?id=introduction--docs';
        await createAndRenderPreview();

        expect(importFn).toHaveBeenCalledWith('./src/ComponentTwo.stories.js');
      });

      it('emits DOCS_RENDERED', async () => {
        document.location.search = '?id=component-one--docs&viewMode=docs';

        await createAndRenderPreview();

        expect(mockChannel.emit).toHaveBeenCalledWith(DOCS_RENDERED, 'component-one--docs');
      });
    });
  });

  describe('onUpdateGlobals', () => {
    it('emits GLOBALS_UPDATED', async () => {
      document.location.search = '?id=component-one--a';
      await createAndRenderPreview();

      emitter.emit(UPDATE_GLOBALS, { globals: { a: 'c' } });

      await waitForEvents([GLOBALS_UPDATED]);
      expect(mockChannel.emit).toHaveBeenCalledWith(GLOBALS_UPDATED, {
        initialGlobals: { a: 'b' },
        userGlobals: { a: 'c' },
        storyGlobals: {},
        globals: { a: 'c' },
      });
    });

    describe('if the story sets globals', () => {
      const newImportFn = vi.fn(async (path) => {
        if (path === './src/ComponentOne.stories.js') {
          return {
            ...componentOneExports,
            a: { ...componentOneExports.a, globals: { a: 'c' } },
          };
        }
        return importFn(path);
      });

      const newGetProjectAnnotations = vi.fn(
        () => ({ ...projectAnnotations, initialGlobals: { a: 'b', c: 'd' } }) as any
      );

      it('allows changes to globals the story did not set', async () => {
        document.location.search = '?id=component-one--a';
        await createAndRenderPreview({
          importFn: newImportFn,
          getProjectAnnotations: newGetProjectAnnotations,
        });

        mockChannel.emit.mockClear();
        emitter.emit(UPDATE_GLOBALS, { globals: { c: 'e' } });

        await waitForEvents([GLOBALS_UPDATED]);
        expect(mockChannel.emit).toHaveBeenCalledWith(GLOBALS_UPDATED, {
          initialGlobals: { a: 'b', c: 'd' },
          userGlobals: { a: 'b', c: 'e' },
          storyGlobals: { a: 'c' },
          globals: { a: 'c', c: 'e' },
        });
      });

      it('does not allow changes to globals the story sets', async () => {
        document.location.search = '?id=component-one--a';
        await createAndRenderPreview({
          importFn: newImportFn,
          getProjectAnnotations: newGetProjectAnnotations,
        });

        mockChannel.emit.mockClear();
        emitter.emit(UPDATE_GLOBALS, { globals: { a: 'e' } });

        await waitForEvents([GLOBALS_UPDATED]);
        expect(mockChannel.emit).toHaveBeenCalledWith(GLOBALS_UPDATED, {
          initialGlobals: { a: 'b', c: 'd' },
          userGlobals: { a: 'e', c: 'd' },
          storyGlobals: { a: 'c' },
          globals: { a: 'c', c: 'd' },
        });
      });
    });

    it('doet not allow new globals on the store', async () => {
      document.location.search = '?id=component-one--a';
      const preview = await createAndRenderPreview();

      emitter.emit(UPDATE_GLOBALS, { globals: { foo: 'bar' } });

      expect((preview.storyStore as StoryStore<Renderer>)!.userGlobals.get()).toEqual({ a: 'b' });
    });

    it('passes globals in context to renderToCanvas', async () => {
      document.location.search = '?id=component-one--a';
      await createAndRenderPreview();

      mockChannel.emit.mockClear();
      projectAnnotations.renderToCanvas.mockClear();
      emitter.emit(UPDATE_GLOBALS, { globals: { a: 'd' } });
      await waitForRender();

      expect(projectAnnotations.renderToCanvas).toHaveBeenCalledWith(
        expect.objectContaining({
          forceRemount: false,
          storyContext: expect.objectContaining({
            globals: { a: 'd' },
          }),
        }),
        'story-element'
      );
    });

    it('emits STORY_RENDERED', async () => {
      document.location.search = '?id=component-one--a';
      await createAndRenderPreview();

      mockChannel.emit.mockClear();
      emitter.emit(UPDATE_GLOBALS, { globals: { a: 'c' } });
      await waitForRender();

      expect(mockChannel.emit).toHaveBeenCalledWith(STORY_RENDERED, 'component-one--a');
    });

    describe('in docs mode', () => {
      it('re-renders the docs container', async () => {
        document.location.search = '?id=component-one--docs&viewMode=docs';

        await createAndRenderPreview();

        mockChannel.emit.mockClear();
        docsRenderer.render.mockClear();
        emitter.emit(UPDATE_GLOBALS, { globals: { a: 'd' } });
        await waitForEvents([GLOBALS_UPDATED]);

        expect(docsRenderer.render).toHaveBeenCalled();
      });
    });
  });

  describe('onUpdateArgs', () => {
    it('emits STORY_ARGS_UPDATED', async () => {
      document.location.search = '?id=component-one--a';
      await createAndRenderPreview();

      emitter.emit(UPDATE_STORY_ARGS, {
        storyId: 'component-one--a',
        updatedArgs: { new: 'arg', one: 1 },
      });

      await waitForEvents([STORY_ARGS_UPDATED]);
      expect(mockChannel.emit).toHaveBeenCalledWith(STORY_ARGS_UPDATED, {
        storyId: 'component-one--a',
        args: { foo: 'a', new: 'arg', one: 1 },
      });
    });

    it('sets new args on the store', async () => {
      document.location.search = '?id=component-one--a';
      const preview = await createAndRenderPreview();

      emitter.emit(UPDATE_STORY_ARGS, {
        storyId: 'component-one--a',
        updatedArgs: { new: 'arg' },
      });

      expect(
        (preview.storyStore as StoryStore<Renderer> as StoryStore<Renderer>)?.args.get(
          'component-one--a'
        )
      ).toEqual({
        foo: 'a',
        new: 'arg',
        one: 1,
      });
    });

    it('passes new args in context to renderToCanvas', async () => {
      document.location.search = '?id=component-one--a';
      await createAndRenderPreview();

      mockChannel.emit.mockClear();
      projectAnnotations.renderToCanvas.mockClear();
      emitter.emit(UPDATE_STORY_ARGS, {
        storyId: 'component-one--a',
        updatedArgs: { new: 'arg' },
      });
      await waitForRender();

      expect(projectAnnotations.renderToCanvas).toHaveBeenCalledWith(
        expect.objectContaining({
          forceRemount: false,
          storyContext: expect.objectContaining({
            initialArgs: { foo: 'a', one: 1 },
            args: { foo: 'a', new: 'arg', one: 'mapped-1' },
          }),
        }),
        'story-element'
      );
    });

    it('emits STORY_RENDERED', async () => {
      document.location.search = '?id=component-one--a';
      await createAndRenderPreview();

      mockChannel.emit.mockClear();
      emitter.emit(UPDATE_STORY_ARGS, {
        storyId: 'component-one--a',
        updatedArgs: { new: 'arg' },
      });
      await waitForRender();

      expect(mockChannel.emit).toHaveBeenCalledWith(STORY_RENDERED, 'component-one--a');
    });

    describe('if play function destructures mount', () => {
      it('passes forceRemount to renderToCanvas', async () => {
        document.location.search = '?id=component-one--a';
        const newImportFn = vi.fn(async (path) => {
          if (path === './src/ComponentOne.stories.js') {
            return {
              ...componentOneExports,
              a: { ...componentOneExports.a, play: ({ mount }: any) => mount() },
            };
          }
          return importFn(path);
        });
        await createAndRenderPreview({ importFn: newImportFn });

        mockChannel.emit.mockClear();
        projectAnnotations.renderToCanvas.mockClear();
        emitter.emit(UPDATE_STORY_ARGS, {
          storyId: 'component-one--a',
          updatedArgs: { new: 'arg' },
        });
        await waitForRender();

        expect(projectAnnotations.renderToCanvas).toHaveBeenCalledWith(
          expect.objectContaining({
            forceRemount: true,
            storyContext: expect.objectContaining({
              initialArgs: { foo: 'a', one: 1 },
              args: { foo: 'a', new: 'arg', one: 'mapped-1' },
            }),
          }),
          'story-element'
        );
      });
    });

    describe('while story is still rendering', () => {
      it('runs loaders again after renderToCanvas is done', async () => {
        // Arrange - set up a gate to control when the loaders run
        const [loadersRanGate, openLoadersRanGate] = createGate();
        const [blockLoadersGate, openBlockLoadersGate] = createGate();

        document.location.search = '?id=component-one--a';
        componentOneExports.default.loaders[0].mockImplementationOnce(async (input) => {
          openLoadersRanGate();
          return blockLoadersGate;
        });

        // Act - render the first time
        await new PreviewWeb(importFn, getProjectAnnotations).ready();
        await loadersRanGate;

        // Assert - loader to be called the first time
        expect(componentOneExports.default.loaders[0]).toHaveBeenCalledOnce();
        expect(componentOneExports.default.loaders[0]).toHaveBeenCalledWith(
          expect.objectContaining({
            args: { foo: 'a', one: 'mapped-1' },
          })
        );

        // Act - update the args (while loader is still running)
        emitter.emit(UPDATE_STORY_ARGS, {
          storyId: 'component-one--a',
          updatedArgs: { new: 'arg' },
        });

        // Arrange - open the gate to let the loader finish and wait for render
        openBlockLoadersGate({ l: 8 });
        await waitForRender();

        // Assert - renderToCanvas to be called the first time with initial args and returned `loaded` value.
        expect(projectAnnotations.renderToCanvas).toHaveBeenCalledOnce();
        expect(projectAnnotations.renderToCanvas).toHaveBeenCalledWith(
          expect.objectContaining({
            forceRemount: true,
            storyContext: expect.objectContaining({
              loaded: { l: 8 }, // This is the value returned by the *first* loader call
              args: { foo: 'a', one: 'mapped-1' },
            }),
          }),
          'story-element'
        );
        // Assert - loaders are not run again yet
        expect(componentOneExports.default.loaders[0]).toHaveBeenCalledOnce();

        // Arrange - wait for loading and rendering to finish a second time
        mockChannel.emit.mockClear();
        await waitForRender();
        // Assert - loader is called a second time with updated args
        await vi.waitFor(() => {
          expect(projectAnnotations.renderToCanvas).toHaveBeenCalledTimes(2);
          expect(componentOneExports.default.loaders[0]).toHaveBeenCalledWith(
            expect.objectContaining({
              args: { foo: 'a', new: 'arg', one: 'mapped-1' },
            })
          );
        });

        // Assert - renderToCanvas is called a second time with updated args
        expect(projectAnnotations.renderToCanvas).toHaveBeenCalledTimes(2);
        expect(projectAnnotations.renderToCanvas).toHaveBeenCalledWith(
          expect.objectContaining({
            forceRemount: false,
            storyContext: expect.objectContaining({
              loaded: { l: 7 }, // This is the value returned by the *second* loader call
              args: { foo: 'a', new: 'arg', one: 'mapped-1' },
            }),
          }),
          'story-element'
        );
      });

      it('renders a second time after the already running renderToCanvas is done', async () => {
        const [gate, openGate] = createGate();

        document.location.search = '?id=component-one--a';
        projectAnnotations.renderToCanvas.mockImplementation(async () => gate);

        await new PreviewWeb(importFn, getProjectAnnotations).ready();
        await waitForRenderPhase('rendering');

        emitter.emit(UPDATE_STORY_ARGS, {
          storyId: 'component-one--a',
          updatedArgs: { new: 'arg' },
        });

        // Now let the first renderToCanvas call resolve
        openGate();
        expect(projectAnnotations.renderToCanvas).toHaveBeenCalledTimes(1);
        expect(projectAnnotations.renderToCanvas).toHaveBeenCalledWith(
          expect.objectContaining({
            forceRemount: true,
            storyContext: expect.objectContaining({
              loaded: { l: 7 },
              args: { foo: 'a', one: 'mapped-1' },
            }),
          }),
          'story-element'
        );

        // Wait for the second render to finish
        mockChannel.emit.mockClear();
        await waitForRender();
        await waitForRenderPhase('rendering');

        // Expect the second render to have the updated args
        expect(projectAnnotations.renderToCanvas).toHaveBeenCalledTimes(2);
        expect(projectAnnotations.renderToCanvas).toHaveBeenCalledWith(
          expect.objectContaining({
            forceRemount: false,
            storyContext: expect.objectContaining({
              loaded: { l: 7 },
              args: { foo: 'a', new: 'arg', one: 'mapped-1' },
            }),
          }),
          'story-element'
        );
      });

      it('calls renderToCanvas again if play function is running', async () => {
        const [gate, openGate] = createGate();
        componentOneExports.a.play.mockImplementationOnce(async () => gate);

        const renderToCanvasCalled = new Promise((resolve) => {
          projectAnnotations.renderToCanvas.mockImplementation(() => {
            resolve(null);
          });
        });

        document.location.search = '?id=component-one--a';
        await new PreviewWeb(importFn, getProjectAnnotations).ready();
        await waitForRenderPhase('playing');

        await renderToCanvasCalled;
        // Story gets rendered with original args
        expect(projectAnnotations.renderToCanvas).toHaveBeenCalledWith(
          expect.objectContaining({
            forceRemount: true,
            storyContext: expect.objectContaining({
              loaded: { l: 7 },
              args: { foo: 'a', one: 'mapped-1' },
            }),
          }),
          'story-element'
        );

        emitter.emit(UPDATE_STORY_ARGS, {
          storyId: 'component-one--a',
          updatedArgs: { new: 'arg' },
        });

        // The second call should emit STORY_RENDERED
        await waitForRender();

        // Story gets rendered with updated args
        expect(projectAnnotations.renderToCanvas).toHaveBeenCalledWith(
          expect.objectContaining({
            forceRemount: false,
            storyContext: expect.objectContaining({
              loaded: { l: 7 },
              args: { foo: 'a', new: 'arg', one: 'mapped-1' },
            }),
          }),
          'story-element'
        );

        // Now let the playFunction call resolve
        openGate();
      });
    });

    describe('in docs mode', () => {
      it('does not re-render the docs container', async () => {
        document.location.search = '?id=component-one--docs&viewMode=docs';

        await createAndRenderPreview();

        docsRenderer.render.mockClear();
        mockChannel.emit.mockClear();
        emitter.emit(UPDATE_STORY_ARGS, {
          storyId: 'component-one--a',
          updatedArgs: { new: 'arg' },
        });
        await waitForEvents([STORY_ARGS_UPDATED]);

        expect(docsRenderer.render).not.toHaveBeenCalled();
      });

      describe('when renderStoryToElement was called', () => {
        const callbacks = { showMain: vi.fn(), showError: vi.fn(), showException: vi.fn() };
        it('re-renders the story', async () => {
          document.location.search = '?id=component-one--docs&viewMode=docs';

          const preview = await createAndRenderPreview();
          await waitForRender();

          mockChannel.emit.mockClear();
          const story = await (preview.storyStore as StoryStore<Renderer>)?.loadStory({
            storyId: 'component-one--a',
          });
          preview.renderStoryToElement(story, 'story-element' as any, callbacks, {});
          await waitForRender();

          expect(projectAnnotations.renderToCanvas).toHaveBeenCalledWith(
            expect.objectContaining({
              storyContext: expect.objectContaining({
                args: { foo: 'a', one: 'mapped-1' },
              }),
            }),
            'story-element'
          );

          docsRenderer.render.mockClear();
          mockChannel.emit.mockClear();
          emitter.emit(UPDATE_STORY_ARGS, {
            storyId: 'component-one--a',
            updatedArgs: { new: 'arg' },
          });
          await waitForRender();

          expect(projectAnnotations.renderToCanvas).toHaveBeenCalledWith(
            expect.objectContaining({
              storyContext: expect.objectContaining({
                args: { foo: 'a', new: 'arg', one: 'mapped-1' },
              }),
            }),
            'story-element'
          );
        });

        it('does not re-render the story when forceInitialArgs=true', async () => {
          document.location.search = '?id=component-one--docs&viewMode=docs';

          const preview = await createAndRenderPreview();
          await waitForRender();

          mockChannel.emit.mockClear();
          const story = await (preview.storyStore as StoryStore<Renderer>)?.loadStory({
            storyId: 'component-one--a',
          });
          preview.renderStoryToElement(story, 'story-element' as any, callbacks, {
            forceInitialArgs: true,
          });
          await waitForRender();

          expect(projectAnnotations.renderToCanvas).toHaveBeenCalledWith(
            expect.objectContaining({
              storyContext: expect.objectContaining({
                args: { foo: 'a', one: 'mapped-1' },
              }),
            }),
            'story-element'
          );

          docsRenderer.render.mockClear();
          mockChannel.emit.mockClear();
          emitter.emit(UPDATE_STORY_ARGS, {
            storyId: 'component-one--a',
            updatedArgs: { new: 'arg' },
          });
          await waitForEvents([STORY_ARGS_UPDATED]);

          // We don't re-render the story
          await expect(waitForRender).rejects.toThrow();
          expect(projectAnnotations.renderToCanvas).toHaveBeenCalledTimes(1);
        });
      });
    });
  });

  describe('onPreloadStories', () => {
    it('loads stories', async () => {
      document.location.search = '?id=component-one--docs&viewMode=docs';
      const preview = await createAndRenderPreview();
      await waitForRender();

      vi.mocked(importFn).mockClear();
      await preview.onPreloadStories({ ids: ['component-two--c'] });
      expect(importFn).toHaveBeenCalledWith('./src/ComponentTwo.stories.js');
    });

    it('loads legacy docs entries', async () => {
      document.location.search = '?id=component-one--docs&viewMode=docs';
      const preview = await createAndRenderPreview();
      await waitForRender();

      vi.mocked(importFn).mockClear();
      await preview.onPreloadStories({ ids: ['component-one--docs'] });
      expect(importFn).toHaveBeenCalledWith('./src/ComponentOne.stories.js');
    });

    it('loads modern docs entries', async () => {
      document.location.search = '?id=component-one--docs&viewMode=docs';
      const preview = await createAndRenderPreview();
      await waitForRender();

      vi.mocked(importFn).mockClear();
      await preview.onPreloadStories({ ids: ['introduction--docs'] });
      expect(importFn).toHaveBeenCalledWith('./src/Introduction.mdx');
    });
    it('loads imports of modern docs entries', async () => {
      document.location.search = '?id=component-one--docs&viewMode=docs';
      const preview = await createAndRenderPreview();
      await waitForRender();

      vi.mocked(importFn).mockClear();
      await preview.onPreloadStories({ ids: ['introduction--docs'] });
      expect(importFn).toHaveBeenCalledWith('./src/ComponentTwo.stories.js');
    });
  });

  describe('onResetArgs', () => {
    it('emits STORY_ARGS_UPDATED', async () => {
      document.location.search = '?id=component-one--a';
      await createAndRenderPreview();

      mockChannel.emit.mockClear();
      emitter.emit(UPDATE_STORY_ARGS, {
        storyId: 'component-one--a',
        updatedArgs: { foo: 'new' },
      });

      await waitForEvents([STORY_ARGS_UPDATED]);
      expect(mockChannel.emit).toHaveBeenCalledWith(STORY_ARGS_UPDATED, {
        storyId: 'component-one--a',
        args: { foo: 'new', one: 1 },
      });

      mockChannel.emit.mockClear();
      emitter.emit(RESET_STORY_ARGS, {
        storyId: 'component-one--a',
        argNames: ['foo'],
      });

      await waitForEvents([STORY_ARGS_UPDATED]);

      expect(mockChannel.emit).toHaveBeenCalledWith(STORY_ARGS_UPDATED, {
        storyId: 'component-one--a',
        args: { foo: 'a', one: 1 },
      });
    });

    it('resets a single arg', async () => {
      document.location.search = '?id=component-one--a';
      const preview = await createAndRenderPreview();
      const onUpdateArgsSpy = vi.spyOn(preview, 'onUpdateArgs');

      mockChannel.emit.mockClear();
      emitter.emit(UPDATE_STORY_ARGS, {
        storyId: 'component-one--a',
        updatedArgs: { foo: 'new', new: 'value' },
      });
      await waitForEvents([STORY_ARGS_UPDATED]);

      mockChannel.emit.mockClear();
      emitter.emit(RESET_STORY_ARGS, {
        storyId: 'component-one--a',
        argNames: ['foo'],
      });

      await waitForRender();

      expect(projectAnnotations.renderToCanvas).toHaveBeenCalledWith(
        expect.objectContaining({
          forceRemount: false,
          storyContext: expect.objectContaining({
            initialArgs: { foo: 'a', one: 1 },
            args: { foo: 'a', new: 'value', one: 'mapped-1' },
          }),
        }),
        'story-element'
      );

      await waitForEvents([STORY_ARGS_UPDATED]);
      expect(mockChannel.emit).toHaveBeenCalledWith(STORY_ARGS_UPDATED, {
        storyId: 'component-one--a',
        args: { foo: 'a', new: 'value', one: 1 },
      });

      expect(onUpdateArgsSpy).toHaveBeenCalledWith({
        storyId: 'component-one--a',
        updatedArgs: { foo: 'a' },
      });
    });

    it('resets all args after one is updated', async () => {
      document.location.search = '?id=component-one--a';
      const preview = await createAndRenderPreview();
      const onUpdateArgsSpy = vi.spyOn(preview, 'onUpdateArgs');

      emitter.emit(UPDATE_STORY_ARGS, {
        storyId: 'component-one--a',
        updatedArgs: { foo: 'new' },
      });
      await waitForEvents([STORY_ARGS_UPDATED]);

      mockChannel.emit.mockClear();
      emitter.emit(RESET_STORY_ARGS, {
        storyId: 'component-one--a',
      });

      await waitForRender();

      expect(projectAnnotations.renderToCanvas).toHaveBeenCalledWith(
        expect.objectContaining({
          forceRemount: false,
          storyContext: expect.objectContaining({
            initialArgs: { foo: 'a', one: 1 },
            args: { foo: 'a', one: 'mapped-1' },
          }),
        }),
        'story-element'
      );

      await waitForEvents([STORY_ARGS_UPDATED]);
      expect(mockChannel.emit).toHaveBeenCalledWith(STORY_ARGS_UPDATED, {
        storyId: 'component-one--a',
        args: { foo: 'a', one: 1 },
      });

      expect(onUpdateArgsSpy).toHaveBeenCalledWith({
        storyId: 'component-one--a',
        updatedArgs: { foo: 'a', one: 1 },
      });
    });

    it('resets all args', async () => {
      document.location.search = '?id=component-one--a';
      const preview = await createAndRenderPreview();
      const onUpdateArgsSpy = vi.spyOn(preview, 'onUpdateArgs');

      emitter.emit(UPDATE_STORY_ARGS, {
        storyId: 'component-one--a',
        updatedArgs: { foo: 'new', new: 'value' },
      });
      await waitForEvents([STORY_ARGS_UPDATED]);

      mockChannel.emit.mockClear();
      emitter.emit(RESET_STORY_ARGS, {
        storyId: 'component-one--a',
      });

      await waitForRender();

      expect(projectAnnotations.renderToCanvas).toHaveBeenCalledWith(
        expect.objectContaining({
          forceRemount: false,
          storyContext: expect.objectContaining({
            initialArgs: { foo: 'a', one: 1 },
            args: { foo: 'a', one: 'mapped-1' },
          }),
        }),
        'story-element'
      );

      await waitForEvents([STORY_ARGS_UPDATED]);
      expect(mockChannel.emit).toHaveBeenCalledWith(STORY_ARGS_UPDATED, {
        storyId: 'component-one--a',
        args: { foo: 'a', one: 1 },
      });

      expect(onUpdateArgsSpy).toHaveBeenCalledWith({
        storyId: 'component-one--a',
        updatedArgs: { foo: 'a', new: undefined, one: 1 },
      });
    });

    it('resets all args when one arg is undefined', async () => {
      document.location.search = '?id=component-one--a';
      const preview = await createAndRenderPreview();
      const onUpdateArgsSpy = vi.spyOn(preview, 'onUpdateArgs');

      emitter.emit(UPDATE_STORY_ARGS, {
        storyId: 'component-one--a',
        updatedArgs: { foo: undefined },
      });
      await waitForEvents([STORY_ARGS_UPDATED]);

      mockChannel.emit.mockClear();
      emitter.emit(RESET_STORY_ARGS, {
        storyId: 'component-one--a',
      });

      await waitForRender();

      expect(projectAnnotations.renderToCanvas).toHaveBeenCalledWith(
        expect.objectContaining({
          forceRemount: false,
          storyContext: expect.objectContaining({
            initialArgs: { foo: 'a', one: 1 },
            args: { foo: 'a', one: 'mapped-1' },
          }),
        }),
        'story-element'
      );

      await waitForEvents([STORY_ARGS_UPDATED]);
      expect(mockChannel.emit).toHaveBeenCalledWith(STORY_ARGS_UPDATED, {
        storyId: 'component-one--a',
        args: { foo: 'a', one: 1 },
      });

      expect(onUpdateArgsSpy).toHaveBeenCalledWith({
        storyId: 'component-one--a',
        updatedArgs: { foo: 'a', one: 1 },
      });
    });
  });

  describe('on FORCE_RE_RENDER', () => {
    it('rerenders the story with the same args', async () => {
      document.location.search = '?id=component-one--a';
      await createAndRenderPreview();

      mockChannel.emit.mockClear();
      projectAnnotations.renderToCanvas.mockClear();
      emitter.emit(FORCE_RE_RENDER);
      await waitForRender();

      expect(projectAnnotations.renderToCanvas).toHaveBeenCalledWith(
        expect.objectContaining({ forceRemount: false }),
        'story-element'
      );
    });
  });

  describe('on FORCE_REMOUNT', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('remounts the story with the same args', async () => {
      document.location.search = '?id=component-one--a';
      await createAndRenderPreview();

      mockChannel.emit.mockClear();
      projectAnnotations.renderToCanvas.mockClear();
      emitter.emit(FORCE_REMOUNT, { storyId: 'component-one--a' });
      await waitForRender();

      expect(projectAnnotations.renderToCanvas).toHaveBeenCalledWith(
        expect.objectContaining({ forceRemount: true }),
        'story-element'
      );
    });

    it('aborts render function for initial story', async () => {
      const [gate, openGate] = createGate();

      document.location.search = '?id=component-one--a';
      projectAnnotations.renderToCanvas.mockImplementation(async () => gate);
      await new PreviewWeb(importFn, getProjectAnnotations).ready();
      await waitForRenderPhase('rendering');

      expect(projectAnnotations.renderToCanvas).toHaveBeenCalledWith(
        expect.objectContaining({
          forceRemount: true,
          storyContext: expect.objectContaining({
            id: 'component-one--a',
            loaded: { l: 7 },
          }),
        }),
        'story-element'
      );

      mockChannel.emit.mockClear();
      emitter.emit(FORCE_REMOUNT, { storyId: 'component-one--a' });

      // Now let the renderToCanvas call resolve
      openGate();
      await waitForRenderPhase('aborted');

      // allow teardown to complete its retries
      vi.runOnlyPendingTimers();

      await waitForRenderPhase('rendering');
      expect(projectAnnotations.renderToCanvas).toHaveBeenCalledTimes(2);

      await waitForRenderPhase('playing');
      expect(componentOneExports.a.play).toHaveBeenCalledTimes(1);

      await waitForRenderPhase('completed');
      expect(mockChannel.emit).toHaveBeenCalledWith(STORY_RENDERED, 'component-one--a');

      await waitForQuiescence();
    });
  });

  describe('onSetCurrentStory', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('updates URL', async () => {
      document.location.search = '?id=component-one--a';
      await createAndRenderPreview();

      emitter.emit(SET_CURRENT_STORY, {
        storyId: 'component-one--b',
        viewMode: 'story',
      });
      await waitForSetCurrentStory();

      expect(history.replaceState).toHaveBeenCalledWith(
        {},
        '',
        'pathname?id=component-one--b&viewMode=story'
      );
    });

    it('emits CURRENT_STORY_WAS_SET', async () => {
      document.location.search = '?id=component-one--a';
      await createAndRenderPreview();

      emitter.emit(SET_CURRENT_STORY, {
        storyId: 'component-one--b',
        viewMode: 'story',
      });
      await vi.waitFor(() => {
        expect(mockChannel.emit).toHaveBeenCalledWith(CURRENT_STORY_WAS_SET, {
          storyId: 'component-one--b',
          viewMode: 'story',
        });
      });

      expect(mockChannel.emit).toHaveBeenCalledWith(CURRENT_STORY_WAS_SET, {
        storyId: 'component-one--b',
        viewMode: 'story',
      });
    });

    it('renders loading error if the story specified does not exist', async () => {
      document.location.search = '?id=component-one--a';
      const preview = await createAndRenderPreview();

      emitter.emit(SET_CURRENT_STORY, {
        storyId: 'random',
        viewMode: 'story',
      });
      await waitForSetCurrentStory();

      await waitForEvents([STORY_MISSING]);
      expect(preview.view.showErrorDisplay).toHaveBeenCalled();
      expect(mockChannel.emit).toHaveBeenCalledWith(STORY_MISSING, 'random');
    });

    describe('if called before the preview is readyd', () => {
      it('works when there was no selection specifier', async () => {
        document.location.search = '';
        // We intentionally are *not* awaiting here
        new PreviewWeb(importFn, getProjectAnnotations).ready();

        emitter.emit(SET_CURRENT_STORY, { storyId: 'component-one--b', viewMode: 'story' });

        await waitForEvents([STORY_RENDERED]);

        // Check we don't render the default "story missing" UI / emit the default message
        expect(mockChannel.emit).not.toHaveBeenCalledWith(STORY_MISSING);

        // We of course should emit for the selected story
        expect(mockChannel.emit).toHaveBeenCalledWith(CURRENT_STORY_WAS_SET, {
          storyId: 'component-one--b',
          viewMode: 'story',
        });
        expect(history.replaceState).toHaveBeenCalledWith(
          {},
          '',
          'pathname?id=component-one--b&viewMode=story'
        );
        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_RENDERED, 'component-one--b');
      });

      it('works when there was a selection specifier', async () => {
        document.location.search = '?id=component-one--a';

        const readyd = new PreviewWeb(importFn, getProjectAnnotations).ready();

        emitter.emit(SET_CURRENT_STORY, { storyId: 'component-one--b', viewMode: 'story' });

        await readyd;
        await waitForEvents([STORY_RENDERED]);

        // If we emitted CURRENT_STORY_WAS_SET for the original selection, the manager might
        // get confused, so check that we don't
        expect(mockChannel.emit).not.toHaveBeenCalledWith(CURRENT_STORY_WAS_SET, {
          storyId: 'component-one--a',
          viewMode: 'story',
        });
        // Double check this doesn't happen either
        expect(mockChannel.emit).not.toHaveBeenCalledWith(STORY_MISSING);

        expect(history.replaceState).toHaveBeenCalledWith(
          {},
          '',
          'pathname?id=component-one--b&viewMode=story'
        );
        expect(mockChannel.emit).toHaveBeenCalledWith(CURRENT_STORY_WAS_SET, {
          storyId: 'component-one--b',
          viewMode: 'story',
        });
        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_RENDERED, 'component-one--b');
      });
    });

    describe('if called on a storybook without selection', () => {
      it('sets viewMode to story by default', async () => {
        await createAndRenderPreview();

        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--b',
        });
        await waitForSetCurrentStory();

        expect(history.replaceState).toHaveBeenCalledWith(
          {},
          '',
          'pathname?id=component-one--b&viewMode=story'
        );
      });
    });

    describe('if the selection is unchanged', () => {
      it('emits STORY_UNCHANGED', async () => {
        document.location.search = '?id=component-one--a';
        await createAndRenderPreview();

        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--a',
          viewMode: 'story',
        });
        await waitForSetCurrentStory();

        await waitForEvents([STORY_UNCHANGED]);
        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_UNCHANGED, 'component-one--a');
      });

      it('does NOT call renderToCanvas', async () => {
        document.location.search = '?id=component-one--a';
        await createAndRenderPreview();

        projectAnnotations.renderToCanvas.mockClear();
        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--a',
          viewMode: 'story',
        });
        await waitForSetCurrentStory();

        // The renderToCanvas would have been async so we need to wait a tick.
        await waitForQuiescence();
        expect(projectAnnotations.renderToCanvas).not.toHaveBeenCalled();
      });

      it('does NOT call renderToCanvas teardown', async () => {
        document.location.search = '?id=component-one--a';
        await createAndRenderPreview();

        projectAnnotations.renderToCanvas.mockClear();
        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--a',
          viewMode: 'story',
        });
        await waitForSetCurrentStory();

        expect(teardownrenderToCanvas).not.toHaveBeenCalled();
      });

      describe('while preparing', () => {
        // For https://github.com/storybookjs/storybook/issues/17214
        it('does NOT render a second time in story mode', async () => {
          document.location.search = '?id=component-one--a';

          const [gate, openGate] = createGate();
          const [importedGate, openImportedGate] = createGate();
          importFn
            // @ts-expect-error (mock)
            .mockImplementationOnce(async (m) => {
              await gate;
              return importFn(m);
            })
            // @ts-expect-error (mock)
            .mockImplementationOnce(async (m) => {
              // The second time we `import()` we open the "imported" gate
              openImportedGate();
              await gate;
              return importFn(m);
            });

          const preview = new PreviewWeb(importFn, getProjectAnnotations);
          // We can't wait for the ready function, as it waits for `renderSelection()`
          // which prepares, but it does emit `CURRENT_STORY_WAS_SET` right before that
          preview.ready();
          await waitForEvents([CURRENT_STORY_WAS_SET]);

          mockChannel.emit.mockClear();
          projectAnnotations.renderToCanvas.mockClear();
          emitter.emit(SET_CURRENT_STORY, {
            storyId: 'component-one--a',
            viewMode: 'story',
          });
          await importedGate;
          // We are blocking import so this won't render yet
          expect(projectAnnotations.renderToCanvas).not.toHaveBeenCalled();

          mockChannel.emit.mockClear();
          openGate();
          await waitForRender();

          // We should only render *once*
          expect(projectAnnotations.renderToCanvas).toHaveBeenCalledTimes(1);

          // We should not show an error either
          expect(preview.view.showErrorDisplay).not.toHaveBeenCalled();
        });

        // For https://github.com/storybookjs/storybook/issues/19015
        it('does NOT render a second time in template docs mode', async () => {
          document.location.search = '?id=component-one--docs&viewMode=docs';

          const [gate, openGate] = createGate();
          const [importedGate, openImportedGate] = createGate();
          importFn
            // @ts-expect-error (mock)
            .mockImplementationOnce(async (m) => {
              await gate;
              return importFn(m);
            })
            // @ts-expect-error (mock)
            .mockImplementationOnce(async (m) => {
              // The second time we `import()` we open the "imported" gate
              openImportedGate();
              await gate;
              return importFn(m);
            });

          const preview = new PreviewWeb(importFn, getProjectAnnotations);
          // We can't wait for the ready function, as it waits for `renderSelection()`
          // which prepares, but it does emit `CURRENT_STORY_WAS_SET` right before that
          preview.ready();
          await waitForEvents([CURRENT_STORY_WAS_SET]);

          mockChannel.emit.mockClear();
          projectAnnotations.renderToCanvas.mockClear();
          emitter.emit(SET_CURRENT_STORY, {
            storyId: 'component-one--docs',
            viewMode: 'docs',
          });
          await importedGate;
          // We are blocking import so this won't render yet
          expect(docsRenderer.render).not.toHaveBeenCalled();

          mockChannel.emit.mockClear();
          openGate();
          await waitForRender();

          // We should only render *once*
          expect(docsRenderer.render).toHaveBeenCalledTimes(1);

          // We should not show an error either
          expect(preview.view.showErrorDisplay).not.toHaveBeenCalled();
        });

        it('does NOT render a second time in mdx docs mode', async () => {
          document.location.search = '?id=introduction--docs&viewMode=docs';

          const [gate, openGate] = createGate();
          const [importedGate, openImportedGate] = createGate();
          importFn
            // @ts-expect-error (mock)
            .mockImplementationOnce(async (m) => {
              await gate;
              return importFn(m);
            })
            // @ts-expect-error (mock)
            .mockImplementationOnce(async (m) => {
              // The second time we `import()` we open the "imported" gate
              openImportedGate();
              await gate;
              return importFn(m);
            });

          const preview = new PreviewWeb(importFn, getProjectAnnotations);
          // We can't wait for the ready function, as it waits for `renderSelection()`
          // which prepares, but it does emit `CURRENT_STORY_WAS_SET` right before that
          preview.ready();
          await waitForEvents([CURRENT_STORY_WAS_SET]);

          mockChannel.emit.mockClear();
          projectAnnotations.renderToCanvas.mockClear();
          emitter.emit(SET_CURRENT_STORY, {
            storyId: 'introduction--docs',
            viewMode: 'docs',
          });
          await importedGate;
          // We are blocking import so this won't render yet
          expect(docsRenderer.render).not.toHaveBeenCalled();

          mockChannel.emit.mockClear();
          openGate();
          await waitForRender();

          // We should only render *once*
          expect(docsRenderer.render).toHaveBeenCalledTimes(1);

          // We should not show an error either
          expect(preview.view.showErrorDisplay).not.toHaveBeenCalled();
        });
      });
    });

    describe('when changing story in story viewMode', () => {
      it('calls renderToCanvas teardown', async () => {
        document.location.search = '?id=component-one--a';
        await createAndRenderPreview();

        projectAnnotations.renderToCanvas.mockClear();
        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--b',
          viewMode: 'story',
        });

        await vi.waitFor(() => {
          expect(teardownrenderToCanvas).toHaveBeenCalled();
        });
      });

      it('updates URL', async () => {
        document.location.search = '?id=component-one--a';
        await createAndRenderPreview();

        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--b',
          viewMode: 'story',
        });
        await waitForSetCurrentStory();

        expect(history.replaceState).toHaveBeenCalledWith(
          {},
          '',
          'pathname?id=component-one--b&viewMode=story'
        );
      });

      it('renders preparing state', async () => {
        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();

        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--b',
          viewMode: 'story',
        });
        await waitForSetCurrentStory();

        expect(preview.view.showPreparingStory).toHaveBeenCalled();
      });

      it('emits STORY_CHANGED', async () => {
        document.location.search = '?id=component-one--a';
        await createAndRenderPreview();

        mockChannel.emit.mockClear();
        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--b',
          viewMode: 'story',
        });
        await waitForSetCurrentStory();

        await waitForEvents([STORY_CHANGED]);
        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_CHANGED, 'component-one--b');
      });

      it('emits STORY_PREPARED', async () => {
        document.location.search = '?id=component-one--a';
        await createAndRenderPreview();

        mockChannel.emit.mockClear();
        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--b',
          viewMode: 'story',
        });
        await waitForSetCurrentStory();

        await waitForEvents([STORY_PREPARED]);
        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_PREPARED, {
          id: 'component-one--b',
          parameters: {
            __isArgsStory: false,
            docs: expect.any(Object),
            fileName: './src/ComponentOne.stories.js',
          },
          initialArgs: { foo: 'b', one: 1 },
          argTypes: {
            foo: { name: 'foo', type: { name: 'string' } },
            one: { name: 'one', type: { name: 'string' }, mapping: { 1: 'mapped-1' } },
          },
          args: { foo: 'b', one: 1 },
        });
      });

      it('emits GLOBALS_UPDATED with initial global values', async () => {
        document.location.search = '?id=component-one--a';
        await createAndRenderPreview();

        mockChannel.emit.mockClear();
        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--b',
          viewMode: 'story',
        });
        await waitForSetCurrentStory();

        await waitForEvents([GLOBALS_UPDATED]);
        expect(mockChannel.emit).toHaveBeenCalledWith(GLOBALS_UPDATED, {
          initialGlobals: { a: 'b' },
          userGlobals: { a: 'b' },
          storyGlobals: {},
          globals: { a: 'b' },
        });
      });

      describe('if the story sets globals', () => {
        it('emits GLOBALS_UPDATED with overridden storyGlobals', async () => {
          document.location.search = '?id=component-one--a';
          const newImportFn = vi.fn(async (path) => {
            if (path === './src/ComponentOne.stories.js') {
              return {
                ...componentOneExports,
                b: { ...componentOneExports.b, globals: { a: 'c' } },
              };
            }
            return importFn(path);
          });

          await createAndRenderPreview({ importFn: newImportFn });
          mockChannel.emit.mockClear();
          emitter.emit(SET_CURRENT_STORY, {
            storyId: 'component-one--b',
            viewMode: 'story',
          });
          await waitForSetCurrentStory();

          await waitForEvents([GLOBALS_UPDATED]);
          expect(mockChannel.emit).toHaveBeenCalledWith(GLOBALS_UPDATED, {
            initialGlobals: { a: 'b' },
            userGlobals: { a: 'b' },
            storyGlobals: { a: 'c' },
            globals: { a: 'c' },
          });
        });
      });

      it('applies loaders with story context', async () => {
        document.location.search = '?id=component-one--a';
        await createAndRenderPreview();

        mockChannel.emit.mockClear();
        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--b',
          viewMode: 'story',
        });
        await waitForSetCurrentStory();

        await waitForRender();
        expect(componentOneExports.default.loaders[0]).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'component-one--b',
            parameters: {
              __isArgsStory: false,
              docs: expect.any(Object),
              fileName: './src/ComponentOne.stories.js',
            },
            initialArgs: { foo: 'b', one: 1 },
            argTypes: {
              foo: { name: 'foo', type: { name: 'string' } },
              one: { name: 'one', type: { name: 'string' }, mapping: { 1: 'mapped-1' } },
            },
            args: { foo: 'b', one: 'mapped-1' },
          })
        );
      });

      it('passes loaded context to renderToCanvas', async () => {
        document.location.search = '?id=component-one--a';
        await createAndRenderPreview();

        mockChannel.emit.mockClear();
        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--b',
          viewMode: 'story',
        });
        await waitForSetCurrentStory();
        await waitForRender();

        expect(projectAnnotations.renderToCanvas).toHaveBeenCalledWith(
          expect.objectContaining({
            forceRemount: true,
            storyContext: expect.objectContaining({
              id: 'component-one--b',
              parameters: {
                __isArgsStory: false,
                docs: expect.any(Object),
                fileName: './src/ComponentOne.stories.js',
              },
              globals: { a: 'b' },
              initialArgs: { foo: 'b', one: 1 },
              argTypes: {
                foo: { name: 'foo', type: { name: 'string' } },
                one: { name: 'one', type: { name: 'string' }, mapping: { 1: 'mapped-1' } },
              },
              args: { foo: 'b', one: 'mapped-1' },
              loaded: { l: 7 },
            }),
          }),
          'story-element'
        );
      });

      it('renders exception if renderToCanvas throws', async () => {
        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();

        const error = new Error('error');
        projectAnnotations.renderToCanvas.mockImplementation(() => {
          throw error;
        });

        mockChannel.emit.mockClear();
        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--b',
          viewMode: 'story',
        });
        await waitForSetCurrentStory();
        await waitForRender();

        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_THREW_EXCEPTION, serializeError(error));
        expect(preview.view.showErrorDisplay).toHaveBeenCalledWith(error);
      });

      it('renders error if the story calls showError', async () => {
        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();

        const error = { title: 'title', description: 'description' };
        projectAnnotations.renderToCanvas.mockImplementation((context) => context.showError(error));

        mockChannel.emit.mockClear();
        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--b',
          viewMode: 'story',
        });
        await waitForSetCurrentStory();
        await waitForRender();

        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_ERRORED, error);
        expect(preview.view.showErrorDisplay).toHaveBeenCalledWith({
          message: error.title,
          stack: error.description,
        });
      });

      it('renders exception if the story calls showException', async () => {
        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();

        const error = new Error('error');
        projectAnnotations.renderToCanvas.mockImplementation((context) =>
          context.showException(error)
        );

        mockChannel.emit.mockClear();
        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--b',
          viewMode: 'story',
        });
        await waitForSetCurrentStory();
        await waitForRender();

        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_THREW_EXCEPTION, serializeError(error));
        expect(preview.view.showErrorDisplay).toHaveBeenCalledWith(error);
      });

      it('executes playFunction', async () => {
        document.location.search = '?id=component-one--a';
        await createAndRenderPreview();

        mockChannel.emit.mockClear();
        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--b',
          viewMode: 'story',
        });
        await waitForSetCurrentStory();
        await waitForRender();

        expect(componentOneExports.b.play).toHaveBeenCalled();
      });

      it('emits STORY_RENDERED', async () => {
        document.location.search = '?id=component-one--a';
        await createAndRenderPreview();

        mockChannel.emit.mockClear();
        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--b',
          viewMode: 'story',
        });
        await waitForSetCurrentStory();
        await waitForRender();

        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_RENDERED, 'component-one--b');
      });

      it('retains any arg changes', async () => {
        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();

        mockChannel.emit.mockClear();
        emitter.emit(UPDATE_STORY_ARGS, {
          storyId: 'component-one--a',
          updatedArgs: { foo: 'updated' },
        });
        await waitForRender();
        expect((preview.storyStore as StoryStore<Renderer>)?.args.get('component-one--a')).toEqual({
          foo: 'updated',
          one: 1,
        });

        mockChannel.emit.mockClear();
        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--b',
          viewMode: 'story',
        });
        await waitForSetCurrentStory();
        await waitForRender();
        expect((preview.storyStore as StoryStore<Renderer>)?.args.get('component-one--a')).toEqual({
          foo: 'updated',
          one: 1,
        });

        mockChannel.emit.mockClear();
        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--a',
          viewMode: 'story',
        });
        await waitForSetCurrentStory();
        await waitForRender();
        expect((preview.storyStore as StoryStore<Renderer>)?.args.get('component-one--a')).toEqual({
          foo: 'updated',
          one: 1,
        });
      });

      describe('while story is still rendering', () => {
        let originalLocation = window.location;
        beforeEach(() => {
          originalLocation = window.location;
          delete (window as Partial<Window>).location;
          window.location = { ...originalLocation, reload: vi.fn() };
        });

        afterEach(() => {
          delete (window as Partial<Window>).location;
          window.location = { ...originalLocation, reload: originalLocation.reload };
        });

        it('aborts render for initial story', async () => {
          const [gate, openGate] = createGate();

          document.location.search = '?id=component-one--a';
          projectAnnotations.renderToCanvas.mockImplementation(async () => gate);
          await new PreviewWeb(importFn, getProjectAnnotations).ready();
          await waitForRenderPhase('rendering');

          mockChannel.emit.mockClear();
          emitter.emit(SET_CURRENT_STORY, {
            storyId: 'component-one--b',
            viewMode: 'story',
          });
          await waitForSetCurrentStory();

          // Now let the renderToCanvas call resolve
          openGate();
          await waitForRenderPhase('aborted');
          await waitForSetCurrentStory();

          await waitForRenderPhase('rendering');
          expect(projectAnnotations.renderToCanvas).toHaveBeenCalledTimes(2);

          await waitForRenderPhase('playing');
          expect(componentOneExports.a.play).not.toHaveBeenCalled();
          expect(componentOneExports.b.play).toHaveBeenCalled();

          await waitForRenderPhase('completed');
          expect(mockChannel.emit).not.toHaveBeenCalledWith(STORY_RENDERED, 'component-one--a');
          expect(mockChannel.emit).toHaveBeenCalledWith(STORY_RENDERED, 'component-one--b');

          await waitForQuiescence();
        });

        it('aborts play function for initial story', async () => {
          const [gate, openGate] = createGate();
          componentOneExports.a.play.mockImplementationOnce(async () => gate);

          document.location.search = '?id=component-one--a';
          await new PreviewWeb(importFn, getProjectAnnotations).ready();
          await waitForRenderPhase('playing');

          expect(projectAnnotations.renderToCanvas).toHaveBeenCalledWith(
            expect.objectContaining({
              forceRemount: true,
              storyContext: expect.objectContaining({
                id: 'component-one--a',
                loaded: { l: 7 },
              }),
            }),
            'story-element'
          );

          mockChannel.emit.mockClear();
          emitter.emit(SET_CURRENT_STORY, {
            storyId: 'component-one--b',
            viewMode: 'story',
          });
          await waitForSetCurrentStory();

          // Now let the playFunction call resolve
          openGate();
          await waitForRenderPhase('aborted');
          await waitForSetCurrentStory();

          await waitForRenderPhase('rendering');
          expect(mockChannel.emit).toHaveBeenCalledWith(STORY_CHANGED, 'component-one--b');
          expect(projectAnnotations.renderToCanvas).toHaveBeenCalledWith(
            expect.objectContaining({
              forceRemount: true,
              storyContext: expect.objectContaining({
                id: 'component-one--b',
                loaded: { l: 7 },
              }),
            }),
            'story-element'
          );

          await waitForRenderPhase('playing');
          await waitForRenderPhase('completed');
          expect(mockChannel.emit).toHaveBeenCalledWith(STORY_RENDERED, 'component-one--b');

          // Final story rendered is not emitted for the first story
          await waitForQuiescence();
          expect(mockChannel.emit).not.toHaveBeenCalledWith(STORY_RENDERED, 'component-one--a');
        });

        it('reloads page if playFunction fails to abort in time', async () => {
          const [gate] = createGate();
          componentOneExports.a.play.mockImplementationOnce(async () => gate);

          document.location.search = '?id=component-one--a';
          await new PreviewWeb(importFn, getProjectAnnotations).ready();
          await waitForRenderPhase('playing');

          expect(projectAnnotations.renderToCanvas).toHaveBeenCalledWith(
            expect.objectContaining({
              forceRemount: true,
              storyContext: expect.objectContaining({
                id: 'component-one--a',
                loaded: { l: 7 },
              }),
            }),
            'story-element'
          );

          mockChannel.emit.mockClear();
          emitter.emit(SET_CURRENT_STORY, {
            storyId: 'component-one--b',
            viewMode: 'story',
          });

          await vi.waitFor(() => {
            expect(window.location.reload).toHaveBeenCalled();
          });
          expect(window.location.reload).toHaveBeenCalled();
          expect(mockChannel.emit).not.toHaveBeenCalledWith(STORY_CHANGED, 'component-one--b');
          expect(projectAnnotations.renderToCanvas).not.toHaveBeenCalledWith(
            expect.objectContaining({
              storyContext: expect.objectContaining({ id: 'component-one--b' }),
            }),
            undefined
          );
        });
      });
    });

    describe('when changing from story viewMode to docs', () => {
      it('emits DOCS_PREPARED', async () => {
        document.location.search = '?id=component-one--a';
        await createAndRenderPreview();

        mockChannel.emit.mockClear();
        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--docs',
          viewMode: 'docs',
        });
        await waitForSetCurrentStory();
        await waitForRender();

        expect(mockChannel.emit).toHaveBeenCalledWith(DOCS_PREPARED, {
          id: 'component-one--docs',
          parameters: {
            docs: expect.any(Object),
            fileName: './src/ComponentOne.stories.js',
          },
        });
      });

      it('calls renderToCanvas teardown', async () => {
        document.location.search = '?id=component-one--a';
        await createAndRenderPreview();

        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--docs',
          viewMode: 'docs',
        });
        await vi.waitFor(() => {
          expect(teardownrenderToCanvas).toHaveBeenCalled();
        });
      });

      it('updates URL', async () => {
        document.location.search = '?id=component-one--a';
        await createAndRenderPreview();

        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--docs',
          viewMode: 'docs',
        });
        await waitForSetCurrentStory();

        expect(history.replaceState).toHaveBeenCalledWith(
          {},
          '',
          'pathname?id=component-one--docs&viewMode=docs'
        );
      });

      it('renders preparing state', async () => {
        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();

        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--docs',
          viewMode: 'docs',
        });
        await vi.waitFor(() => {
          expect(preview.view.showPreparingDocs).toHaveBeenCalled();
        });
      });

      it('emits STORY_CHANGED', async () => {
        document.location.search = '?id=component-one--a';
        await createAndRenderPreview();

        mockChannel.emit.mockClear();
        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--docs',
          viewMode: 'docs',
        });
        await waitForSetCurrentStory();

        await waitForEvents([STORY_CHANGED]);
        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_CHANGED, 'component-one--docs');
      });

      it('calls view.prepareForDocs', async () => {
        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();

        mockChannel.emit.mockClear();
        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--docs',
          viewMode: 'docs',
        });
        await waitForSetCurrentStory();
        await waitForRender();

        expect(preview.view.prepareForDocs).toHaveBeenCalled();
      });

      it('render the docs container with the correct context, template render', async () => {
        document.location.search = '?id=component-one--a';
        await createAndRenderPreview();

        mockChannel.emit.mockClear();
        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--docs',
          viewMode: 'docs',
        });
        await waitForSetCurrentStory();
        await waitForRender();

        expect(docsRenderer.render).toHaveBeenCalled();
        expect(docsRenderer.render.mock.calls[0][0].storyById()).toMatchObject({
          id: 'component-one--a',
        });
      });

      it('emits DOCS_RENDERED', async () => {
        document.location.search = '?id=component-one--a';
        await createAndRenderPreview();

        mockChannel.emit.mockClear();
        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--docs',
          viewMode: 'docs',
        });
        await waitForSetCurrentStory();
        await waitForRender();

        expect(mockChannel.emit).toHaveBeenCalledWith(DOCS_RENDERED, 'component-one--docs');
      });
    });

    describe('when changing from docs viewMode to story', () => {
      it('unmounts docs', async () => {
        document.location.search = '?id=component-one--docs&viewMode=docs';
        await createAndRenderPreview();

        mockChannel.emit.mockClear();
        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--a',
          viewMode: 'story',
        });
        await waitForSetCurrentStory();
        await waitForRender();

        expect(docsRenderer.unmount).toHaveBeenCalled();
      });

      // this test seems to somehow affect the test above, I re-ordered them to get it green, but someone should look into this
      it('updates URL', async () => {
        document.location.search = '?id=component-one--docs&viewMode=docs';
        await createAndRenderPreview();

        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--a',
          viewMode: 'story',
        });
        await waitForSetCurrentStory();

        expect(history.replaceState).toHaveBeenCalledWith(
          {},
          '',
          'pathname?id=component-one--a&viewMode=story'
        );
      });

      // NOTE: I am not sure this entirely makes sense but this is the behaviour from 6.3
      it('emits STORY_CHANGED', async () => {
        document.location.search = '?id=component-one--docs&viewMode=docs';
        await createAndRenderPreview();

        mockChannel.emit.mockClear();
        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--a',
          viewMode: 'story',
        });
        await waitForSetCurrentStory();

        await waitForEvents([STORY_CHANGED]);
        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_CHANGED, 'component-one--a');
      });

      it('calls view.prepareForStory', async () => {
        document.location.search = '?id=component-one--docs&viewMode=docs';
        const preview = await createAndRenderPreview();

        mockChannel.emit.mockClear();
        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--a',
          viewMode: 'story',
        });
        await waitForSetCurrentStory();
        await waitForRender();

        expect(preview.view.prepareForStory).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'component-one--a',
          })
        );
      });

      it('emits STORY_PREPARED', async () => {
        document.location.search = '?id=component-one--docs&viewMode=docs';
        await createAndRenderPreview();

        mockChannel.emit.mockClear();
        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--a',
          viewMode: 'story',
        });
        await waitForSetCurrentStory();

        await waitForEvents([STORY_PREPARED]);
        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_PREPARED, {
          id: 'component-one--a',
          parameters: {
            __isArgsStory: false,
            docs: expect.any(Object),
            fileName: './src/ComponentOne.stories.js',
          },
          initialArgs: { foo: 'a', one: 1 },
          argTypes: {
            foo: { name: 'foo', type: { name: 'string' } },
            one: { name: 'one', type: { name: 'string' }, mapping: { 1: 'mapped-1' } },
          },
          args: { foo: 'a', one: 1 },
        });
      });

      it('applies loaders with story context', async () => {
        document.location.search = '?id=component-one--docs&viewMode=docs';
        await createAndRenderPreview();

        mockChannel.emit.mockClear();
        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--a',
          viewMode: 'story',
        });
        await waitForSetCurrentStory();

        await waitForRender();
        expect(componentOneExports.default.loaders[0]).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'component-one--a',
            parameters: {
              __isArgsStory: false,
              docs: expect.any(Object),
              fileName: './src/ComponentOne.stories.js',
            },
            initialArgs: { foo: 'a', one: 1 },
            argTypes: {
              foo: { name: 'foo', type: { name: 'string' } },
              one: { name: 'one', type: { name: 'string' }, mapping: { 1: 'mapped-1' } },
            },
            args: { foo: 'a', one: 'mapped-1' },
          })
        );
      });

      it('passes loaded context to renderToCanvas', async () => {
        document.location.search = '?id=component-one--docs&viewMode=docs';
        await createAndRenderPreview();

        mockChannel.emit.mockClear();
        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--a',
          viewMode: 'story',
        });
        await waitForSetCurrentStory();
        await waitForRender();

        expect(projectAnnotations.renderToCanvas).toHaveBeenCalledWith(
          expect.objectContaining({
            forceRemount: true,
            storyContext: expect.objectContaining({
              id: 'component-one--a',
              parameters: {
                __isArgsStory: false,
                docs: expect.any(Object),
                fileName: './src/ComponentOne.stories.js',
              },
              globals: { a: 'b' },
              initialArgs: { foo: 'a', one: 1 },
              argTypes: {
                foo: { name: 'foo', type: { name: 'string' } },
                one: { name: 'one', type: { name: 'string' }, mapping: { 1: 'mapped-1' } },
              },
              args: { foo: 'a', one: 'mapped-1' },
              loaded: { l: 7 },
            }),
          }),
          'story-element'
        );
      });

      it('renders exception if renderToCanvas throws', async () => {
        document.location.search = '?id=component-one--docs&viewMode=docs';
        const preview = await createAndRenderPreview();

        const error = new Error('error');
        projectAnnotations.renderToCanvas.mockImplementation(() => {
          throw error;
        });

        mockChannel.emit.mockClear();
        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--a',
          viewMode: 'story',
        });
        await waitForSetCurrentStory();
        await waitForRender();

        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_THREW_EXCEPTION, serializeError(error));
        expect(preview.view.showErrorDisplay).toHaveBeenCalledWith(error);
      });

      it('renders error if the story calls showError', async () => {
        const error = { title: 'title', description: 'description' };
        projectAnnotations.renderToCanvas.mockImplementation((context) => context.showError(error));

        document.location.search = '?id=component-one--docs&viewMode=docs';
        const preview = await createAndRenderPreview();

        mockChannel.emit.mockClear();
        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--a',
          viewMode: 'story',
        });
        await waitForSetCurrentStory();
        await waitForRender();

        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_ERRORED, error);
        expect(preview.view.showErrorDisplay).toHaveBeenCalledWith({
          message: error.title,
          stack: error.description,
        });
      });

      it('renders exception if the story calls showException', async () => {
        const error = new Error('error');
        projectAnnotations.renderToCanvas.mockImplementation((context) =>
          context.showException(error)
        );

        document.location.search = '?id=component-one--docs&viewMode=docs';
        const preview = await createAndRenderPreview();

        mockChannel.emit.mockClear();
        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--a',
          viewMode: 'story',
        });
        await waitForSetCurrentStory();
        await waitForRender();

        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_THREW_EXCEPTION, serializeError(error));
        expect(preview.view.showErrorDisplay).toHaveBeenCalledWith(error);
      });

      it('executes playFunction', async () => {
        document.location.search = '?id=component-one--docs&viewMode=docs';
        await createAndRenderPreview();

        mockChannel.emit.mockClear();
        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--a',
          viewMode: 'story',
        });
        await waitForSetCurrentStory();
        await waitForRender();

        expect(componentOneExports.a.play).toHaveBeenCalled();
      });

      it('emits STORY_RENDERED', async () => {
        document.location.search = '?id=component-one--docs&viewMode=docs';
        await createAndRenderPreview();

        mockChannel.emit.mockClear();
        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--a',
          viewMode: 'story',
        });
        await waitForSetCurrentStory();
        await waitForRender();

        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_RENDERED, 'component-one--a');
      });
    });
  });

  describe('onStoriesChanged', () => {
    describe('if stories.json endpoint 500s initially', () => {
      it('recovers and renders the story', async () => {
        document.location.search = '?id=component-one--a';
        const err = new Error('sort error');
        mockFetchResult = { status: 500, text: async () => err.toString() };

        const preview = new PreviewWeb(importFn, getProjectAnnotations);
        await expect(preview.ready()).rejects.toThrow('sort error');

        expect(preview.view.showErrorDisplay).toHaveBeenCalled();
        expect(mockChannel.emit).toHaveBeenCalledWith(CONFIG_ERROR, expect.any(Error));

        mockChannel.emit.mockClear();
        mockFetchResult = { status: 200, json: mockStoryIndex, text: () => 'error text' };
        preview.onStoryIndexChanged();
        await waitForRender();
        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_RENDERED, 'component-one--a');
      });

      it('sets story args from the URL', async () => {
        document.location.search = '?id=component-one--a&args=foo:url';
        const err = new Error('sort error');
        mockFetchResult = { status: 500, text: async () => err.toString() };

        const preview = new PreviewWeb(importFn, getProjectAnnotations);
        await expect(preview.ready()).rejects.toThrow('sort error');

        expect(preview.view.showErrorDisplay).toHaveBeenCalled();
        expect(mockChannel.emit).toHaveBeenCalledWith(CONFIG_ERROR, expect.any(Error));

        mockChannel.emit.mockClear();
        mockFetchResult = { status: 200, json: mockStoryIndex, text: () => 'error text' };
        preview.onStoryIndexChanged();
        await waitForRender();
        expect((preview.storyStore as StoryStore<Renderer>)?.args.get('component-one--a')).toEqual({
          foo: 'url',
          one: 1,
        });
      });
    });

    describe('if called twice simultaneously', () => {
      it('does not get renders confused', async () => {
        const [blockImportFnGate, openBlockImportFnGate] = createGate();
        const [importFnCalledGate, openImportFnCalledGate] = createGate();
        const newImportFn = vi.fn(async (path) => {
          openImportFnCalledGate();
          await blockImportFnGate;
          return importFn(path);
        });

        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();
        mockChannel.emit.mockClear();

        preview.onStoriesChanged({ importFn: newImportFn });
        await importFnCalledGate;
        preview.onStoriesChanged({ importFn });

        openBlockImportFnGate();
        await waitForRender();

        expect(preview.storyRenders.length).toEqual(1);
      });

      it('renders the second importFn', async () => {
        const [importGate, openImportGate] = createGate();
        const [importedGate, openImportedGate] = createGate();
        const secondImportFn = vi.fn(async (path) => {
          openImportedGate();
          await importGate;
          return importFn(path);
        });

        const thirdImportFn = vi.fn(async (path) => {
          openImportedGate();
          await importGate;
          return importFn(path);
        });

        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();
        mockChannel.emit.mockClear();

        preview.onStoriesChanged({ importFn: secondImportFn });
        await importedGate;
        preview.onStoriesChanged({ importFn: thirdImportFn });

        openImportGate();
        await waitForRender();

        expect(thirdImportFn).toHaveBeenCalled();
      });
    });

    describe('when the current story changes', () => {
      const newComponentOneExports = toMerged(componentOneExports, {
        a: { args: { foo: 'edited' } },
      });
      const newImportFn = vi.fn(async (path) => {
        return path === './src/ComponentOne.stories.js'
          ? newComponentOneExports
          : componentTwoExports;
      });

      it('calls renderToCanvas teardown', async () => {
        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();
        mockChannel.emit.mockClear();

        preview.onStoriesChanged({ importFn: newImportFn });
        await waitForRender();

        expect(teardownrenderToCanvas).toHaveBeenCalled();
      });

      it('does not emit STORY_UNCHANGED', async () => {
        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();
        mockChannel.emit.mockClear();

        preview.onStoriesChanged({ importFn: newImportFn });
        await waitForRender();

        expect(mockChannel.emit).not.toHaveBeenCalledWith(STORY_UNCHANGED, 'component-one--a');
      });

      it('does not emit STORY_CHANGED', async () => {
        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();
        mockChannel.emit.mockClear();

        preview.onStoriesChanged({ importFn: newImportFn });
        await waitForRender();

        expect(mockChannel.emit).not.toHaveBeenCalledWith(STORY_CHANGED, 'component-one--a');
      });

      it('emits STORY_PREPARED with new annotations', async () => {
        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();
        mockChannel.emit.mockClear();

        preview.onStoriesChanged({ importFn: newImportFn });
        await waitForRender();

        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_PREPARED, {
          id: 'component-one--a',
          parameters: {
            __isArgsStory: false,
            docs: expect.any(Object),
            fileName: './src/ComponentOne.stories.js',
          },
          initialArgs: { foo: 'edited', one: 1 },
          argTypes: {
            foo: { name: 'foo', type: { name: 'string' } },
            one: { name: 'one', type: { name: 'string' }, mapping: { 1: 'mapped-1' } },
          },
          args: { foo: 'edited', one: 1 },
        });
      });

      it('applies loaders with story context', async () => {
        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();

        mockChannel.emit.mockClear();
        componentOneExports.default.loaders[0].mockClear();
        preview.onStoriesChanged({ importFn: newImportFn });
        await waitForRender();

        expect(componentOneExports.default.loaders[0]).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'component-one--a',
            parameters: {
              __isArgsStory: false,
              docs: expect.any(Object),
              fileName: './src/ComponentOne.stories.js',
            },
            initialArgs: { foo: 'edited', one: 1 },
            argTypes: {
              foo: { name: 'foo', type: { name: 'string' } },
              one: { name: 'one', type: { name: 'string' }, mapping: { 1: 'mapped-1' } },
            },
            args: { foo: 'edited', one: 'mapped-1' },
          })
        );
      });

      it('passes loaded context to renderToCanvas', async () => {
        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();

        mockChannel.emit.mockClear();
        projectAnnotations.renderToCanvas.mockClear();
        preview.onStoriesChanged({ importFn: newImportFn });
        await waitForRender();

        expect(projectAnnotations.renderToCanvas).toHaveBeenCalledWith(
          expect.objectContaining({
            forceRemount: true,
            storyContext: expect.objectContaining({
              id: 'component-one--a',
              parameters: {
                __isArgsStory: false,
                docs: expect.any(Object),
                fileName: './src/ComponentOne.stories.js',
              },
              globals: { a: 'b' },
              initialArgs: { foo: 'edited', one: 1 },
              argTypes: {
                foo: { name: 'foo', type: { name: 'string' } },
                one: { name: 'one', type: { name: 'string' }, mapping: { 1: 'mapped-1' } },
              },
              args: { foo: 'edited', one: 'mapped-1' },
              loaded: { l: 7 },
            }),
          }),
          'story-element'
        );
      });

      it('retains the same delta to the args', async () => {
        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();

        mockChannel.emit.mockClear();
        emitter.emit(UPDATE_STORY_ARGS, {
          storyId: 'component-one--a',
          updatedArgs: { foo: 'updated' },
        });
        await waitForRender();

        mockChannel.emit.mockClear();
        projectAnnotations.renderToCanvas.mockClear();
        preview.onStoriesChanged({ importFn: newImportFn });
        await waitForRender();

        expect(projectAnnotations.renderToCanvas).toHaveBeenCalledWith(
          expect.objectContaining({
            forceRemount: true,
            storyContext: expect.objectContaining({
              id: 'component-one--a',
              args: { foo: 'updated', one: 'mapped-1' },
            }),
          }),
          'story-element'
        );
      });

      it('renders exception if renderToCanvas throws', async () => {
        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();

        const error = new Error('error');
        projectAnnotations.renderToCanvas.mockImplementation(() => {
          throw error;
        });

        mockChannel.emit.mockClear();
        preview.onStoriesChanged({ importFn: newImportFn });
        await waitForRender();

        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_THREW_EXCEPTION, serializeError(error));
        expect(preview.view.showErrorDisplay).toHaveBeenCalledWith(error);
      });

      it('renders error if the story calls showError', async () => {
        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();

        const error = { title: 'title', description: 'description' };
        projectAnnotations.renderToCanvas.mockImplementation((context) => context.showError(error));

        mockChannel.emit.mockClear();
        preview.onStoriesChanged({ importFn: newImportFn });
        await waitForRender();

        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_ERRORED, error);
        expect(preview.view.showErrorDisplay).toHaveBeenCalledWith({
          message: error.title,
          stack: error.description,
        });
      });

      it('renders exception if the story calls showException', async () => {
        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();

        const error = new Error('error');
        projectAnnotations.renderToCanvas.mockImplementation((context) =>
          context.showException(error)
        );

        mockChannel.emit.mockClear();
        preview.onStoriesChanged({ importFn: newImportFn });
        await waitForRender();

        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_THREW_EXCEPTION, serializeError(error));
        expect(preview.view.showErrorDisplay).toHaveBeenCalledWith(error);
      });

      it('executes playFunction', async () => {
        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();

        mockChannel.emit.mockClear();
        componentOneExports.a.play.mockClear();
        preview.onStoriesChanged({ importFn: newImportFn });
        await waitForRender();

        expect(componentOneExports.a.play).toHaveBeenCalled();
      });

      it('emits STORY_RENDERED', async () => {
        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();

        mockChannel.emit.mockClear();
        preview.onStoriesChanged({ importFn: newImportFn });
        await waitForRender();

        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_RENDERED, 'component-one--a');
      });
    });

    describe('when the current story changes importPath', () => {
      const newImportFn = vi.fn(async (path) => ({ ...componentOneExports }));

      const newStoryIndex = {
        v: 5,
        entries: {
          ...storyIndex.entries,
          'component-one--a': {
            ...storyIndex.entries['component-one--a'],
            importPath: './src/ComponentOne-new.stories.js',
          },
        },
      };
      beforeEach(() => {
        newImportFn.mockClear();
      });

      it('re-imports the component', async () => {
        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();

        mockChannel.emit.mockClear();
        preview.onStoriesChanged({ importFn: newImportFn, storyIndex: newStoryIndex });
        await waitForRender();

        expect(newImportFn).toHaveBeenCalledWith('./src/ComponentOne-new.stories.js');
      });

      describe('if it was previously rendered', () => {
        beforeEach(() => {
          vi.useFakeTimers();
        });
        afterEach(() => {
          vi.useRealTimers();
        });
        it('is reloaded when it is re-selected', async () => {
          document.location.search = '?id=component-one--a';
          const preview = await createAndRenderPreview();

          mockChannel.emit.mockClear();
          emitter.emit(SET_CURRENT_STORY, {
            storyId: 'component-one--b',
            viewMode: 'story',
          });
          await waitForSetCurrentStory();
          await waitForRender();

          preview.onStoriesChanged({ importFn: newImportFn, storyIndex: newStoryIndex });

          mockChannel.emit.mockClear();
          emitter.emit(SET_CURRENT_STORY, {
            storyId: 'component-one--a',
            viewMode: 'story',
          });
          await waitForSetCurrentStory();
          await waitForRender();
          expect(newImportFn).toHaveBeenCalledWith('./src/ComponentOne-new.stories.js');
        });
      });
    });

    describe('when the current story has not changed', () => {
      const newComponentTwoExports = { ...componentTwoExports };
      const newImportFn = vi.fn(async (path) => {
        return path === './src/ComponentOne.stories.js'
          ? componentOneExports
          : newComponentTwoExports;
      });

      it('does NOT call renderToCanvas teardown', async () => {
        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();

        mockChannel.emit.mockClear();
        preview.onStoriesChanged({ importFn: newImportFn });
        await waitForEvents([STORY_UNCHANGED]);

        expect(teardownrenderToCanvas).not.toHaveBeenCalled();
      });

      it('emits STORY_UNCHANGED', async () => {
        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();

        mockChannel.emit.mockClear();
        preview.onStoriesChanged({ importFn: newImportFn });
        await waitForEvents([STORY_UNCHANGED]);

        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_UNCHANGED, 'component-one--a');
        expect(mockChannel.emit).not.toHaveBeenCalledWith(STORY_CHANGED, 'component-one--a');
      });

      it('clears preparing state', async () => {
        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();

        vi.mocked(preview.view.showMain).mockClear();
        mockChannel.emit.mockClear();
        preview.onStoriesChanged({ importFn: newImportFn });
        await waitForEvents([STORY_UNCHANGED]);

        expect(preview.view.showMain).toHaveBeenCalled();
      });

      it('does not re-render the story', async () => {
        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();

        mockChannel.emit.mockClear();
        projectAnnotations.renderToCanvas.mockClear();
        preview.onStoriesChanged({ importFn: newImportFn });
        await waitForQuiescence();

        expect(projectAnnotations.renderToCanvas).not.toHaveBeenCalled();
        expect(mockChannel.emit).not.toHaveBeenCalledWith(STORY_RENDERED, 'component-one--a');
      });
    });

    describe('when another (not current) story changes', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });
      afterEach(() => {
        vi.useRealTimers();
      });
      const newComponentOneExports = toMerged(componentOneExports, {
        a: { args: { bar: 'edited' }, argTypes: { bar: { type: { name: 'string' } } } },
      });
      const newImportFn = vi.fn(async (path) => {
        return path === './src/ComponentOne.stories.js'
          ? newComponentOneExports
          : componentTwoExports;
      });
      it('retains the same delta to the args', async () => {
        // Start at Story A
        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();

        // Change A's args
        mockChannel.emit.mockClear();
        emitter.emit(UPDATE_STORY_ARGS, {
          storyId: 'component-one--a',
          updatedArgs: { foo: 'updated' },
        });
        await waitForRender();

        // Change to story B
        mockChannel.emit.mockClear();
        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--b',
          viewMode: 'story',
        });
        await waitForSetCurrentStory();
        await waitForRender();
        expect((preview.storyStore as StoryStore<Renderer>)?.args.get('component-one--a')).toEqual({
          foo: 'updated',
          one: 1,
        });

        // Update story A's args via HMR
        mockChannel.emit.mockClear();
        projectAnnotations.renderToCanvas.mockClear();
        preview.onStoriesChanged({ importFn: newImportFn });
        await waitForRender();

        // Change back to Story A
        mockChannel.emit.mockClear();
        emitter.emit(SET_CURRENT_STORY, {
          storyId: 'component-one--a',
          viewMode: 'story',
        });
        await waitForSetCurrentStory();
        await waitForRender();
        expect((preview.storyStore as StoryStore<Renderer>)?.args.get('component-one--a')).toEqual({
          foo: 'updated',
          bar: 'edited',
          one: 1,
        });

        expect(projectAnnotations.renderToCanvas).toHaveBeenCalledWith(
          expect.objectContaining({
            forceRemount: true,
            storyContext: expect.objectContaining({
              id: 'component-one--a',
              args: { foo: 'updated', bar: 'edited', one: 'mapped-1' },
            }),
          }),
          'story-element'
        );
      });
    });

    describe('if the story no longer exists', () => {
      const { a, ...componentOneExportsWithoutA } = componentOneExports;
      const newImportFn = vi.fn(async (path) => {
        return path === './src/ComponentOne.stories.js'
          ? componentOneExportsWithoutA
          : componentTwoExports;
      });

      const newStoryIndex = {
        v: 5,
        entries: {
          'component-one--b': storyIndex.entries['component-one--b'],
        },
      };

      it('calls renderToCanvas teardown', async () => {
        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();

        mockChannel.emit.mockClear();
        preview.onStoriesChanged({ importFn: newImportFn, storyIndex: newStoryIndex });
        await waitForEvents([STORY_MISSING]);

        expect(teardownrenderToCanvas).toHaveBeenCalled();
      });

      it('renders loading error', async () => {
        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();

        mockChannel.emit.mockClear();
        preview.onStoriesChanged({ importFn: newImportFn, storyIndex: newStoryIndex });
        await waitForEvents([STORY_MISSING]);

        expect(preview.view.showErrorDisplay).toHaveBeenCalled();
        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_MISSING, 'component-one--a');
      });

      it('does not re-render the story', async () => {
        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();

        mockChannel.emit.mockClear();
        projectAnnotations.renderToCanvas.mockClear();
        preview.onStoriesChanged({ importFn: newImportFn, storyIndex: newStoryIndex });
        await waitForQuiescence();

        expect(projectAnnotations.renderToCanvas).not.toHaveBeenCalled();
        expect(mockChannel.emit).not.toHaveBeenCalledWith(STORY_RENDERED, 'component-one--a');
      });

      it('re-renders the story if it is readded', async () => {
        document.location.search = '?id=component-one--a';
        const preview = await createAndRenderPreview();

        mockChannel.emit.mockClear();
        preview.onStoriesChanged({ importFn: newImportFn, storyIndex: newStoryIndex });
        await waitForEvents([STORY_MISSING]);

        mockChannel.emit.mockClear();
        preview.onStoriesChanged({ importFn, storyIndex });
        await waitForRender();
        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_RENDERED, 'component-one--a');
      });
    });

    describe('when a mdx docs file changes', () => {
      const newUnattachedDocsExports = { default: vi.fn() };

      const newImportFn = vi.fn(async (path: string) => {
        return path === './src/Introduction.mdx' ? newUnattachedDocsExports : importFn(path);
      });

      it('emits DOCS_PREPARED', async () => {
        document.location.search = '?id=introduction--docs';
        const preview = await createAndRenderPreview();

        mockChannel.emit.mockClear();
        docsRenderer.render.mockClear();

        preview.onStoriesChanged({ importFn: newImportFn });
        await waitForRender();

        expect(mockChannel.emit).toHaveBeenCalledWith(DOCS_PREPARED, {
          id: 'introduction--docs',
          parameters: {
            docs: expect.any(Object),
          },
        });
      });

      it('renders with the generated docs parameters', async () => {
        document.location.search = '?id=introduction--docs&viewMode=docs';
        const preview = await createAndRenderPreview();
        mockChannel.emit.mockClear();
        docsRenderer.render.mockClear();

        preview.onStoriesChanged({ importFn: newImportFn });
        await waitForRender();

        expect(docsRenderer.render).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            page: newUnattachedDocsExports.default,
            renderer: projectAnnotations.parameters.docs.renderer,
          }),
          'docs-element'
        );
      });

      it('emits DOCS_RENDERED', async () => {
        document.location.search = '?id=introduction--docs&viewMode=docs';
        const preview = await createAndRenderPreview();
        mockChannel.emit.mockClear();

        preview.onStoriesChanged({ importFn: newImportFn });
        await waitForRender();

        expect(mockChannel.emit).toHaveBeenCalledWith(DOCS_RENDERED, 'introduction--docs');
      });
    });
  });

  describe('onGetProjectAnnotationsChanged', () => {
    describe('if initial getProjectAnnotations threw', () => {
      it('recovers and renders the story', async () => {
        document.location.search = '?id=component-one--a';

        const err = new Error('meta error');
        const preview = new PreviewWeb(importFn, () => {
          throw err;
        });
        await expect(preview.ready()).rejects.toThrow(err);

        preview.onGetProjectAnnotationsChanged({ getProjectAnnotations });
        await waitForRender();

        expect(mockChannel.emit).toHaveBeenCalledWith(STORY_RENDERED, 'component-one--a');
      });

      it('sets globals from the URL', async () => {
        document.location.search = '?id=*&globals=a:c';

        const err = new Error('meta error');
        const preview = new PreviewWeb(importFn, () => {
          throw err;
        });
        await expect(preview.ready()).rejects.toThrow(err);

        preview.onGetProjectAnnotationsChanged({ getProjectAnnotations });
        await waitForRender();

        expect((preview.storyStore as StoryStore<Renderer>)!.userGlobals.get()).toEqual({ a: 'c' });
      });
    });

    describe('with no selection', () => {
      it('does not error', async () => {
        const preview = await createAndRenderPreview();
        await preview.onGetProjectAnnotationsChanged({
          getProjectAnnotations: newGetProjectAnnotations,
        });
      });
    });

    it('shows an error the new value throws', async () => {
      document.location.search = '?id=component-one--a';
      const preview = await createAndRenderPreview();

      mockChannel.emit.mockClear();
      const err = new Error('error getting meta');
      await expect(
        preview.onGetProjectAnnotationsChanged({
          getProjectAnnotations: () => {
            throw err;
          },
        })
      ).rejects.toThrow(err);

      expect(preview.view.showErrorDisplay).toHaveBeenCalled();
      expect(mockChannel.emit).toHaveBeenCalledWith(CONFIG_ERROR, err);
    });

    const newGlobalDecorator = vi.fn((s: any) => s());
    const newGetProjectAnnotations = () => {
      return {
        ...projectAnnotations,
        args: { global: 'added' },
        initialGlobals: { a: 'edited' },
        decorators: [newGlobalDecorator],
      };
    };

    it('updates globals to their new values', async () => {
      document.location.search = '?id=component-one--a';
      const preview = await createAndRenderPreview();

      mockChannel.emit.mockClear();
      preview.onGetProjectAnnotationsChanged({ getProjectAnnotations: newGetProjectAnnotations });
      await waitForRender();

      expect((preview.storyStore as StoryStore<Renderer>)!.userGlobals.get()).toEqual({
        a: 'edited',
      });
    });

    it('emits SET_GLOBALS with new values', async () => {
      document.location.search = '?id=component-one--a';
      const preview = await createAndRenderPreview();

      mockChannel.emit.mockClear();
      preview.onGetProjectAnnotationsChanged({ getProjectAnnotations: newGetProjectAnnotations });
      await waitForRender();

      await waitForEvents([SET_GLOBALS]);
      expect(mockChannel.emit).toHaveBeenCalledWith(SET_GLOBALS, {
        globals: { a: 'edited' },
        globalTypes: {},
      });
    });

    it('updates args to their new values', async () => {
      document.location.search = '?id=component-one--a';
      const preview = await createAndRenderPreview();

      mockChannel.emit.mockClear();
      preview.onGetProjectAnnotationsChanged({ getProjectAnnotations: newGetProjectAnnotations });
      await waitForRender();

      expect((preview.storyStore as StoryStore<Renderer>)?.args.get('component-one--a')).toEqual({
        foo: 'a',
        one: 1,
        global: 'added',
      });
    });

    it('emits SET_PREPARED with new args', async () => {
      document.location.search = '?id=component-one--a';
      const preview = await createAndRenderPreview();

      mockChannel.emit.mockClear();
      preview.onGetProjectAnnotationsChanged({ getProjectAnnotations: newGetProjectAnnotations });
      await waitForRender();

      expect(mockChannel.emit).toHaveBeenCalledWith(
        STORY_PREPARED,
        expect.objectContaining({
          id: 'component-one--a',
          args: { foo: 'a', one: 1, global: 'added' },
        })
      );
    });

    it('calls renderToCanvas teardown', async () => {
      document.location.search = '?id=component-one--a';
      const preview = await createAndRenderPreview();

      projectAnnotations.renderToCanvas.mockClear();
      mockChannel.emit.mockClear();
      preview.onGetProjectAnnotationsChanged({ getProjectAnnotations: newGetProjectAnnotations });
      await waitForRender();

      expect(teardownrenderToCanvas).toHaveBeenCalled();
    });

    it('rerenders the current story with new global meta-generated context', async () => {
      document.location.search = '?id=component-one--a';
      const preview = await createAndRenderPreview();

      projectAnnotations.renderToCanvas.mockClear();
      mockChannel.emit.mockClear();
      preview.onGetProjectAnnotationsChanged({ getProjectAnnotations: newGetProjectAnnotations });
      await waitForRender();

      expect(projectAnnotations.renderToCanvas).toHaveBeenCalledWith(
        expect.objectContaining({
          storyContext: expect.objectContaining({
            args: { foo: 'a', one: 'mapped-1', global: 'added' },
            globals: { a: 'edited' },
          }),
        }),
        'story-element'
      );
    });
  });

  describe('onKeydown', () => {
    it('emits PREVIEW_KEYDOWN for regular elements', async () => {
      document.location.search = '?id=component-one--docs&viewMode=docs';
      const preview = await createAndRenderPreview();

      preview.onKeydown({
        composedPath: vi
          .fn()
          .mockReturnValue([{ tagName: 'div', getAttribute: vi.fn().mockReturnValue(null) }]),
      } as any);

      expect(mockChannel.emit).toHaveBeenCalledWith(PREVIEW_KEYDOWN, expect.objectContaining({}));
    });

    it('emits PREVIEW_KEYDOWN for regular elements, fallback to event.target', async () => {
      document.location.search = '?id=component-one--docs&viewMode=docs';
      const preview = await createAndRenderPreview();

      preview.onKeydown({
        target: { tagName: 'div', getAttribute: vi.fn().mockReturnValue(null) },
      } as any);

      expect(mockChannel.emit).toHaveBeenCalledWith(PREVIEW_KEYDOWN, expect.objectContaining({}));
    });

    it('does not emit PREVIEW_KEYDOWN for input elements', async () => {
      document.location.search = '?id=component-one--docs&viewMode=docs';
      const preview = await createAndRenderPreview();

      preview.onKeydown({
        composedPath: vi
          .fn()
          .mockReturnValue([{ tagName: 'input', getAttribute: vi.fn().mockReturnValue(null) }]),
      } as any);

      expect(mockChannel.emit).not.toHaveBeenCalledWith(
        PREVIEW_KEYDOWN,
        expect.objectContaining({})
      );
    });

    it('does not emit PREVIEW_KEYDOWN during story play functions', async () => {
      document.location.search = '?id=component-one--a';

      const [gate, openGate] = createGate();
      componentOneExports.a.play.mockImplementationOnce(async () => gate);
      const preview = new PreviewWeb(importFn, getProjectAnnotations);
      await preview.ready();
      await waitForRenderPhase('playing');

      await preview.onKeydown({
        target: { tagName: 'div', getAttribute: vi.fn().mockReturnValue(null) },
      } as any);

      expect(mockChannel.emit).not.toHaveBeenCalledWith(
        PREVIEW_KEYDOWN,
        expect.objectContaining({})
      );
      openGate();
    });

    it('does not emit PREVIEW_KEYDOWN during docs play functions', async () => {
      document.location.search = '?id=component-one--a';

      const preview = await createAndRenderPreview();

      mockChannel.emit.mockClear();
      const [gate, openGate] = createGate();
      componentOneExports.b.play.mockImplementationOnce(async () => gate);
      // @ts-expect-error (not strict)
      preview.renderStoryToElement(
        await (preview.storyStore as StoryStore<Renderer>)?.loadStory({
          storyId: 'component-one--b',
        }),
        {} as any,
        {} as any
      );
      await waitForRenderPhase('playing');

      await preview.onKeydown({
        target: { tagName: 'div', getAttribute: vi.fn().mockReturnValue(null) },
      } as any);

      expect(mockChannel.emit).not.toHaveBeenCalledWith(
        PREVIEW_KEYDOWN,
        expect.objectContaining({})
      );
      openGate();
    });
  });

  describe('extract', () => {
    it('throws an error if preview.js throws', async () => {
      const err = new Error('meta error');
      const preview = new PreviewWeb(importFn, () => {
        throw err;
      });
      await expect(preview.ready()).rejects.toThrow(/meta error/);
      await expect(preview.extract()).rejects.toThrow();
    });

    it('shows an error if the stories.json endpoint 500s', async () => {
      const err = new Error('sort error');
      mockFetchResult = { status: 500, text: async () => err.toString() };

      const preview = new PreviewWeb(importFn, getProjectAnnotations);
      await expect(preview.ready()).rejects.toThrow('sort error');

      await expect(preview.extract()).rejects.toThrow();
    });

    it('waits for stories to be cached', async () => {
      const [gate, openGate] = createGate();

      const gatedImportFn = async (path: string) => {
        await gate;
        return importFn(path);
      };

      const preview = await createAndRenderPreview({ importFn: gatedImportFn });

      let extracted = false;
      preview.extract().then(() => {
        extracted = true;
      });

      expect(extracted).toBe(false);

      openGate();
      await new Promise((r) => setTimeout(r, 0)); // Let the promise resolve
      expect(extracted).toBe(true);

      expect(await preview.extract()).toMatchInlineSnapshot(`
        {
          "component-one--a": {
            "argTypes": {
              "foo": {
                "name": "foo",
                "type": {
                  "name": "string",
                },
              },
              "one": {
                "mapping": {
                  "1": "mapped-1",
                },
                "name": "one",
                "type": {
                  "name": "string",
                },
              },
            },
            "args": {
              "foo": "a",
              "one": 1,
            },
            "component": undefined,
            "componentId": "component-one",
            "id": "component-one--a",
            "initialArgs": {
              "foo": "a",
              "one": 1,
            },
            "kind": "Component One",
            "name": "A",
            "parameters": {
              "__isArgsStory": false,
              "docs": {
                "container": [MockFunction spy],
                "page": [MockFunction spy],
                "renderer": [Function],
              },
              "fileName": "./src/ComponentOne.stories.js",
            },
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
              "foo": {
                "name": "foo",
                "type": {
                  "name": "string",
                },
              },
              "one": {
                "mapping": {
                  "1": "mapped-1",
                },
                "name": "one",
                "type": {
                  "name": "string",
                },
              },
            },
            "args": {
              "foo": "b",
              "one": 1,
            },
            "component": undefined,
            "componentId": "component-one",
            "id": "component-one--b",
            "initialArgs": {
              "foo": "b",
              "one": 1,
            },
            "kind": "Component One",
            "name": "B",
            "parameters": {
              "__isArgsStory": false,
              "docs": {
                "container": [MockFunction spy],
                "page": [MockFunction spy],
                "renderer": [Function],
              },
              "fileName": "./src/ComponentOne.stories.js",
            },
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
          "component-one--e": {
            "argTypes": {},
            "args": {},
            "component": undefined,
            "componentId": "component-one",
            "id": "component-one--e",
            "initialArgs": {},
            "kind": "Component One",
            "name": "E",
            "parameters": {
              "__isArgsStory": false,
              "docs": {
                "page": [MockFunction spy],
                "renderer": [Function],
              },
              "fileName": "./src/ExtraComponentOne.stories.js",
            },
            "playFunction": undefined,
            "story": "E",
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
              "docs": {
                "renderer": [Function],
              },
              "fileName": "./src/ComponentTwo.stories.js",
            },
            "playFunction": undefined,
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
  });
});
