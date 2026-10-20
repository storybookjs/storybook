// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Channel } from 'storybook/internal/channels';
import { logger } from 'storybook/internal/client-logger';
import type { CleanupCallback } from 'storybook/internal/csf';
import {
  STORY_FINISHED,
  STORY_RENDERED,
  STORY_RENDER_PHASE_CHANGED,
} from 'storybook/internal/core-events';
import {
  ArgTypesRemovedFromStoryContextError,
  MissingRenderToCanvasError,
} from 'storybook/internal/preview-errors';
import type {
  PreparedStory,
  RenderContext,
  Renderer,
  StoryContext,
  StoryIndexEntry,
} from 'storybook/internal/types';

import { ReporterAPI, type StoryStore } from '../../store/index.ts';
import { PREPARE_ABORTED } from './Render.ts';
import { StoryRender, serializeError } from './StoryRender.ts';
import { waitForAnimations } from './animation-utils.ts';

// happy-dom has no document.getAnimations, so the completing phase would never wait.
vi.mock('./animation-utils.ts', { spy: true });

const entry = {
  type: 'story',
  subtype: 'story',
  id: 'component--a',
  name: 'A',
  title: 'component',
  importPath: './component.stories.ts',
} as StoryIndexEntry;

const createGate = (): [Promise<void>, () => void] => {
  let openGate = () => {};
  const gate = new Promise<void>((resolve) => {
    openGate = resolve;
  });
  return [gate, openGate];
};
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const storyAUrl = 'http://localhost/iframe.html?id=component--a&viewMode=story';
window.location = { href: storyAUrl, reload: vi.fn() } as any;

const mountSpy = vi.fn(async (context) => {
  await context.renderToCanvas();
  return context.canvas;
});

const buildStory = (overrides: Partial<PreparedStory> = {}): PreparedStory =>
  ({
    id: 'id',
    title: 'title',
    name: 'name',
    tags: [],
    parameters: {},
    applyLoaders: vi.fn(),
    applyBeforeEach: vi.fn(() => []),
    applyAfterEach: vi.fn(),
    unboundStoryFn: vi.fn(),
    playFunction: vi.fn(),
    mount: (context: StoryContext) => () => mountSpy(context),
    renderToCanvas: vi.fn(),
    ...overrides,
  }) as any;

const buildStore = (overrides: Partial<StoryStore<Renderer>> = {}): StoryStore<Renderer> =>
  ({
    getStoryContext: () => ({
      reporting: new ReporterAPI(),
    }),
    addCleanupCallbacks: vi.fn(),
    cleanupStory: vi.fn(),
    ...overrides,
  }) as any;

// A store that keeps the cleanups of its one story and runs them like the real one.
const buildStoreWithCleanups = () => {
  let cleanups: CleanupCallback[] = [];
  return buildStore({
    addCleanupCallbacks: vi.fn((_story, ...callbacks) => {
      cleanups = cleanups.concat(callbacks);
    }),
    cleanupStory: vi.fn(async () => {
      const callbacks = cleanups;
      cleanups = [];
      for (const callback of callbacks.reverse()) {
        await callback();
      }
    }),
  });
};

beforeEach(() => {
  vi.restoreAllMocks();
  window.location.href = storyAUrl;
});

describe('StoryRender', () => {
  it('renders with the renderToCanvas of the story', async () => {
    const renderToCanvas = vi.fn();
    const canvasElement = {} as any;
    const render = new StoryRender(
      new Channel({}),
      buildStore(),
      {} as any,
      entry.id,
      'story',
      { autoplay: true },
      buildStory({ renderToCanvas })
    );

    await render.renderToElement(canvasElement);

    expect(renderToCanvas).toHaveBeenCalledOnce();
    expect(renderToCanvas).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'id' }),
      canvasElement
    );
  });

  it("renders with the project's renderToCanvas when the story has none", async () => {
    const projectRenderToCanvas = vi.fn();
    const canvasElement = {} as any;
    const render = new StoryRender(
      new Channel({}),
      buildStore({ projectAnnotations: { renderToCanvas: projectRenderToCanvas } as any }),
      {} as any,
      entry.id,
      'story',
      { autoplay: true },
      buildStory({ renderToCanvas: undefined })
    );

    await render.renderToElement(canvasElement);

    expect(projectRenderToCanvas).toHaveBeenCalledOnce();
    expect(projectRenderToCanvas).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'id' }),
      canvasElement
    );
  });

  it('shows an exception when neither the story nor the project has a renderToCanvas', async () => {
    const callbacks = { showException: vi.fn() };
    const render = new StoryRender(
      new Channel({}),
      buildStore({ projectAnnotations: {} as any }),
      callbacks as any,
      entry.id,
      'story',
      { autoplay: true },
      buildStory({ renderToCanvas: undefined })
    );

    await render.renderToElement({} as any);

    expect(callbacks.showException).toHaveBeenCalledWith(expect.any(MissingRenderToCanvasError));
  });

  it('does run play function if passed autoplay=true', async () => {
    const story = buildStory();
    const render = new StoryRender(
      new Channel({}),
      buildStore(),
      {} as any,
      entry.id,
      'story',
      { autoplay: true },
      story
    );

    await render.renderToElement({} as any);
    expect(story.playFunction).toHaveBeenCalled();
  });

  it('does not run play function if passed autoplay=false', async () => {
    const story = buildStory();
    const render = new StoryRender(
      new Channel({}),
      buildStore(),
      {} as any,
      entry.id,
      'story',
      { autoplay: false },
      story
    );

    await render.renderToElement({} as any);
    expect(story.playFunction).not.toHaveBeenCalled();
  });

  it('only rerenders once when triggered multiple times while pending', async () => {
    // Arrange - setup StoryRender and async gate blocking applyLoaders
    const [loaderGate, openLoaderGate] = createGate();
    const renderToCanvas = vi.fn();

    const story = buildStory({
      applyLoaders: vi.fn(() => loaderGate as any),
      renderToCanvas,
    });
    const render = new StoryRender(
      new Channel({}),
      buildStore(),
      {} as any,
      entry.id,
      'story',
      { autoplay: true },
      story
    );
    // Arrange - render (blocked by loaders)
    render.renderToElement({} as any);
    expect(story.applyLoaders).toHaveBeenCalledOnce();
    expect(render.phase).toBe('loading');

    // Act - rerender 3x
    render.rerender();
    render.rerender();
    render.rerender();

    // Assert - still loading, not yet rendered
    expect(story.applyLoaders).toHaveBeenCalledOnce();
    expect(render.phase).toBe('loading');
    expect(renderToCanvas).not.toHaveBeenCalled();

    // Act - finish loading
    openLoaderGate();

    // Assert - loaded and rendered twice, played once
    await vi.waitFor(async () => {
      expect(story.applyLoaders).toHaveBeenCalledTimes(2);
      expect(renderToCanvas).toHaveBeenCalledTimes(2);
      expect(story.playFunction).toHaveBeenCalledOnce();
    });
  });

  it('calls mount if play function does not destructure mount', async () => {
    const story = buildStory({
      playFunction: () => {},
    });
    const render = new StoryRender(
      new Channel({}),
      buildStore(),
      {} as any,
      entry.id,
      'story',
      { autoplay: true },
      story
    );

    await render.renderToElement({} as any);
    expect(mountSpy).toHaveBeenCalledOnce();
  });

  it('hides argTypes from lifecycle hooks but passes them to the renderer', async () => {
    const argTypes = { label: { name: 'label' } };
    const hookContexts: StoryContext[] = [];
    const renderToCanvas = vi.fn();
    const story = buildStory({
      applyLoaders: vi.fn(async (context) => {
        hookContexts.push(context);
        return {};
      }),
      applyBeforeEach: vi.fn(async (context) => {
        hookContexts.push(context);
        return [];
      }),
      playFunction: vi.fn(async (context) => {
        hookContexts.push(context);
        await context.step('step', async (stepContext: StoryContext) => {
          hookContexts.push(stepContext);
        });
      }),
      applyAfterEach: vi.fn(async (context) => {
        hookContexts.push(context);
      }),
      runStep: vi.fn((label, play, context) => play(context)),
      renderToCanvas,
    });
    const render = new StoryRender(
      new Channel({}),
      buildStore({
        getStoryContext: () => ({ argTypes, reporting: new ReporterAPI() }) as any,
      }),
      {} as any,
      entry.id,
      'story',
      { autoplay: true },
      story
    );

    await render.renderToElement({} as any);

    expect(hookContexts).toHaveLength(5);
    for (const context of hookContexts) {
      expect(() => context.argTypes).toThrow(ArgTypesRemovedFromStoryContextError);
      expect('argTypes' in context).toBe(false);
    }
    expect(renderToCanvas.mock.calls[0][0].storyContext.argTypes).toBe(argTypes);
  });

  it('does not call mount twice if mount called in play function', async () => {
    const story = buildStory({
      usesMount: true,
      playFunction: async ({ mount }) => {
        await mount();
      },
    });
    const render = new StoryRender(
      new Channel({}),
      buildStore(),
      {} as any,
      entry.id,
      'story',
      { autoplay: true },
      story
    );

    await render.renderToElement({} as any);
    expect(mountSpy).toHaveBeenCalledOnce();
  });

  it('errors if play function calls mount without destructuring', async () => {
    const story = buildStory({
      playFunction: async (context) => {
        await context.mount();
      },
    });
    const view = { showException: vi.fn() };
    const render = new StoryRender(
      new Channel({}),
      buildStore(),
      view as any,
      entry.id,
      'story',
      { autoplay: true },
      story
    );

    await render.renderToElement({} as any);
    expect(view.showException).toHaveBeenCalled();
  });

  it('errors if play function destructures mount but does not call it', async () => {
    const story = buildStory({
      usesMount: true,
      playFunction: async ({ mount }) => {
        // forget to call mount
      },
    });
    const view = { showException: vi.fn() };
    const render = new StoryRender(
      new Channel({}),
      buildStore(),
      view as any,
      entry.id,
      'story',
      { autoplay: true },
      story
    );

    await render.renderToElement({} as any);
    expect(view.showException).toHaveBeenCalled();
  });

  it('enters rendering phase during play if play function calls mount', async () => {
    const actualMount = vi.fn(async (context) => {
      await context.renderToCanvas();
      expect(render.phase).toBe('rendering');
      return context.canvas;
    });
    const story = buildStory({
      mount: (context) => () => actualMount(context) as any,
      renderToCanvas: vi.fn(() => {
        expect(render.phase).toBe('rendering');
      }) as any,
      usesMount: true,
      playFunction: async ({ mount }) => {
        expect(render.phase).toBe('loading');
        await mount();
        expect(render.phase).toBe('playing');
      },
    });
    const render = new StoryRender(
      new Channel({}),
      buildStore(),
      {} as any,
      entry.id,
      'story',
      { autoplay: true },
      story
    );

    await render.renderToElement({} as any);
    expect(actualMount).toHaveBeenCalled();
  });

  it('should handle the "finished" phase correctly when the story finishes successfully', async () => {
    // Arrange - setup StoryRender and async gate blocking finished phase
    const [finishGate, resolveFinishGate] = createGate();
    const story = buildStory({
      playFunction: vi.fn(async () => {
        await finishGate;
      }),
    });
    const store = buildStore();

    const channel = new Channel({});
    const emitSpy = vi.spyOn(channel, 'emit');

    const render = new StoryRender(
      channel,
      store,
      {} as any,
      entry.id,
      'story',
      { autoplay: true },
      story
    );

    // Act - render, resolve finish gate, teardown
    render.renderToElement({} as any);
    await tick(); // go from 'loading' to 'rendering' phase
    resolveFinishGate();
    await tick(); // go from 'rendering' to 'finished' phase
    render.teardown();

    // Assert - ensure finished phase is handled correctly
    expect(render.phase).toBe('finished');
    expect(emitSpy).toHaveBeenCalledWith(STORY_FINISHED, {
      reporters: [],
      status: 'success',
      storyId: 'id',
    });
  });

  it('should handle the "finished" phase correctly when the story throws an error', async () => {
    // Arrange - setup StoryRender and async gate blocking finished phase
    const [finishGate, rejectFinishGate] = createGate();
    const error = new Error('Test error');
    const story = buildStory({
      parameters: {},
      playFunction: vi.fn(async () => {
        await finishGate;
        throw error;
      }),
    });
    const store = buildStore();

    const channel = new Channel({});
    const emitSpy = vi.spyOn(channel, 'emit');

    const render = new StoryRender(
      channel,
      store,
      {
        showException: vi.fn(),
      } as any,
      entry.id,
      'story',
      { autoplay: true },
      story
    );

    // Act - render, reject finish gate, teardown
    render.renderToElement({} as any);
    await tick(); // go from 'loading' to 'rendering' phase
    rejectFinishGate();
    await tick(); // go from 'rendering' to 'finished' phase
    render.teardown();

    // Assert - ensure finished phase is handled correctly
    expect(render.phase).toBe('finished');
    expect(emitSpy).toHaveBeenCalledWith(STORY_FINISHED, {
      reporters: [],
      status: 'error',
      storyId: 'id',
    });
  });

  describe('teardown', () => {
    it('throws PREPARE_ABORTED if torndown during prepare', async () => {
      const [importGate, openImportGate] = createGate();
      const mockStore = buildStore({
        loadStory: vi.fn(async () => {
          await importGate;
          return {};
        }) as any,
      });

      const render = new StoryRender(new Channel({}), mockStore, {} as any, entry.id, 'story');

      const preparePromise = render.prepare();

      render.teardown();

      openImportGate();

      await expect(preparePromise).rejects.toThrowError(PREPARE_ABORTED);
    });

    it('leaves the story cleanups alone when torn down before it rendered', async () => {
      const store = buildStore({ loadStory: vi.fn(async () => buildStory()) as any });
      const render = new StoryRender(new Channel({}), store, {} as any, entry.id, 'story');

      await render.prepare();
      await render.teardown();

      expect(store.cleanupStory).not.toHaveBeenCalled();
    });

    it('cleans up once per pass when torn down by several callers', async () => {
      const store = buildStore();
      const render = new StoryRender(
        new Channel({}),
        store,
        {} as any,
        entry.id,
        'story',
        { autoplay: true },
        buildStory()
      );
      await render.renderToElement({} as any);

      await render.remount();
      await Promise.all([render.teardown(), render.teardown()]);

      expect(store.cleanupStory).toHaveBeenCalledTimes(2);
    });

    it('runs a cleanup that beforeEach returns after the teardown began', async () => {
      const [beforeEachGate, openBeforeEachGate] = createGate();
      const cleanup = vi.fn();
      const store = buildStoreWithCleanups();
      const story = buildStory({
        applyBeforeEach: vi.fn(async () => {
          await beforeEachGate;
          return [cleanup];
        }),
      });
      const render = new StoryRender(
        new Channel({}),
        store,
        {} as any,
        entry.id,
        'story',
        { autoplay: true },
        story
      );

      render.renderToElement({} as any);
      await vi.waitFor(() => expect(story.applyBeforeEach).toHaveBeenCalledOnce());
      const tearingDown = render.teardown();
      openBeforeEachGate();
      await tearingDown;

      expect(cleanup).toHaveBeenCalledOnce();
      expect(window.location.reload).not.toHaveBeenCalled();
    });

    it('leaves the cleanups of another render of the same story alone', async () => {
      const [beforeEachGate, openBeforeEachGate] = createGate();
      const cleanup = vi.fn();
      const siblingCleanup = vi.fn();
      const store = buildStoreWithCleanups();
      const story = buildStory({
        applyBeforeEach: vi.fn(async () => {
          await beforeEachGate;
          return [cleanup];
        }),
      });
      const render = new StoryRender(
        new Channel({}),
        store,
        {} as any,
        entry.id,
        'story',
        { autoplay: true },
        story
      );
      const sibling = new StoryRender(
        new Channel({}),
        store,
        {} as any,
        entry.id,
        'docs',
        { autoplay: true },
        buildStory({ applyBeforeEach: vi.fn(async () => [siblingCleanup]) })
      );

      render.renderToElement({} as any);
      await vi.waitFor(() => expect(story.applyBeforeEach).toHaveBeenCalledOnce());
      const tearingDown = render.teardown();
      await sibling.renderToElement({} as any);
      openBeforeEachGate();
      await tearingDown;

      expect(cleanup).toHaveBeenCalledOnce();
      expect(siblingCleanup).not.toHaveBeenCalled();
      expect(window.location.reload).not.toHaveBeenCalled();
    });

    it('keeps the cleanups of a remounted render until its teardown', async () => {
      const cleanup = vi.fn();
      const store = buildStoreWithCleanups();
      const render = new StoryRender(
        new Channel({}),
        store,
        {} as any,
        entry.id,
        'story',
        { autoplay: true },
        buildStory({ applyBeforeEach: vi.fn(async () => [cleanup]) })
      );
      await render.renderToElement({} as any);

      await render.remount();
      expect(cleanup).toHaveBeenCalledOnce();

      await render.teardown();
      expect(cleanup).toHaveBeenCalledTimes(2);
    });

    it('runs the cleanup of a cycle remounted during its beforeEach before the next cycle', async () => {
      const [beforeEachGate, openBeforeEachGate] = createGate();
      const calls: string[] = [];
      let cycle = 0;
      const story = buildStory({
        applyBeforeEach: vi.fn(async () => {
          const current = ++cycle;
          calls.push(`beforeEach ${current}`);
          if (current === 1) {
            await beforeEachGate;
          }
          return [() => calls.push(`cleanup ${current}`)];
        }),
      });
      const render = new StoryRender(
        new Channel({}),
        buildStoreWithCleanups(),
        {} as any,
        entry.id,
        'story',
        { autoplay: true },
        story
      );

      render.renderToElement({} as any);
      await vi.waitFor(() => expect(cycle).toBe(1));
      const remounting = render.remount();
      openBeforeEachGate();
      await remounting;

      expect(calls).toEqual(['beforeEach 1', 'cleanup 1', 'beforeEach 2']);
    });

    it('does not mount again when torn down while it remounts', async () => {
      const [cleanupGate, openCleanupGate] = createGate();
      const store = buildStore({ cleanupStory: vi.fn(() => cleanupGate) });
      const renderToCanvas = vi.fn();
      const render = new StoryRender(
        new Channel({}),
        store,
        {} as any,
        entry.id,
        'story',
        { autoplay: true },
        buildStory({ renderToCanvas })
      );
      await render.renderToElement({} as any);

      const remounting = render.remount();
      const tearingDown = render.teardown();
      openCleanupGate();
      await Promise.all([remounting, tearingDown]);

      expect(renderToCanvas).toHaveBeenCalledTimes(1);
    });

    it('stops after the completing phase when torn down during it', async () => {
      const [completingGate, openCompletingGate] = createGate();
      vi.mocked(waitForAnimations).mockImplementationOnce(() => completingGate);
      const story = buildStory({ playFunction: undefined });
      const channel = new Channel({});
      const emitSpy = vi.spyOn(channel, 'emit');
      const render = new StoryRender(
        channel,
        buildStore(),
        {} as any,
        entry.id,
        'story',
        { autoplay: true },
        story
      );

      render.renderToElement({} as any);
      await vi.waitFor(() => expect(render.phase).toBe('completing'));
      await render.teardown();
      openCompletingGate();
      await tick();

      const phases = emitSpy.mock.calls
        .filter(([event]) => event === STORY_RENDER_PHASE_CHANGED)
        .map(([, { newPhase }]) => newPhase);
      expect(phases).toEqual(['loading', 'rendering', 'completing', 'aborted']);
      expect(emitSpy).not.toHaveBeenCalledWith(STORY_RENDERED, expect.anything());
      expect(emitSpy).not.toHaveBeenCalledWith(STORY_FINISHED, expect.anything());
      expect(story.applyAfterEach).not.toHaveBeenCalled();
    });

    it('does not report a remounted render as aborted when its previous cycle finishes late', async () => {
      const [completingGate, openCompletingGate] = createGate();
      const [playGate, openPlayGate] = createGate();
      vi.mocked(waitForAnimations).mockImplementationOnce(() => completingGate);
      const story = buildStory({
        playFunction: vi
          .fn()
          .mockImplementationOnce(async () => {})
          .mockImplementationOnce(() => playGate),
      });
      const channel = new Channel({});
      const emitSpy = vi.spyOn(channel, 'emit');
      const render = new StoryRender(
        channel,
        buildStore(),
        {} as any,
        entry.id,
        'story',
        { autoplay: true },
        story
      );

      render.renderToElement({} as any);
      await vi.waitFor(() => expect(render.phase).toBe('completing'));
      const remounted = render.remount();
      await vi.waitFor(() => expect(render.phase).toBe('playing'));
      openCompletingGate();
      await tick();
      openPlayGate();
      await remounted;

      const phases = emitSpy.mock.calls
        .filter(([event]) => event === STORY_RENDER_PHASE_CHANGED)
        .map(([, { newPhase }]) => newPhase);
      expect(phases.slice(phases.lastIndexOf('rendering'))).toEqual([
        'rendering',
        'playing',
        'played',
        'completing',
        'completed',
        'afterEach',
        'finished',
      ]);
    });

    it('reloads the page when tearing down during loading', async () => {
      // Arrange - setup StoryRender and async gate blocking applyLoaders
      const [loaderGate] = createGate();
      const story = buildStory({
        applyLoaders: vi.fn(() => loaderGate as any),
      });
      const store = buildStore();
      const render = new StoryRender(
        new Channel({}),
        store,
        {} as any,
        entry.id,
        'story',
        { autoplay: true },
        story
      );

      // Act - render (blocked by loaders), teardown
      render.renderToElement({} as any);
      expect(story.applyLoaders).toHaveBeenCalledOnce();
      expect(render.phase).toBe('loading');
      render.teardown();

      // Assert - window is reloaded
      await vi.waitFor(() => {
        expect(window.location.reload).toHaveBeenCalledOnce();
        expect(store.cleanupStory).toHaveBeenCalledOnce();
      });
    });

    it('reloads the page when tearing down during rendering', async () => {
      // Arrange - setup StoryRender and async gate blocking renderToCanvas
      const [renderGate] = createGate();
      const renderToCanvas = vi.fn(() => renderGate);
      const story = buildStory({ renderToCanvas: renderToCanvas as any });
      const store = buildStore();

      const render = new StoryRender(
        new Channel({}),
        store,
        {} as any,
        entry.id,
        'story',
        { autoplay: true },
        story
      );

      // Act - render (blocked by renderToCanvas), teardown
      render.renderToElement({} as any);
      await tick(); // go from 'loading' to 'rendering' phase
      expect(renderToCanvas).toHaveBeenCalledOnce();
      expect(render.phase).toBe('rendering');
      render.teardown();

      // Assert - window is reloaded
      await vi.waitFor(() => {
        expect(window.location.reload).toHaveBeenCalledOnce();
        expect(store.cleanupStory).toHaveBeenCalledOnce();
      });
    });

    it('reloads the page when tearing down during playing', async () => {
      // Arrange - setup StoryRender and async gate blocking playing
      const [playGate] = createGate();
      const story = buildStory({
        playFunction: vi.fn(() => playGate as any),
      });
      const store = buildStore();

      const render = new StoryRender(
        new Channel({}),
        store,
        {} as any,
        entry.id,
        'story',
        { autoplay: true },
        story
      );

      // Act - render (blocked by playFn), teardown
      render.renderToElement({} as any);
      await tick(); // go from 'loading' to 'beforeEach' phase
      await tick(); // go from 'beforeEach' to 'playing' phase
      expect(story.playFunction).toHaveBeenCalledOnce();
      expect(render.phase).toBe('playing');
      render.teardown();

      // Assert - window is reloaded
      await vi.waitFor(() => {
        expect(window.location.reload).toHaveBeenCalledOnce();
        expect(store.cleanupStory).toHaveBeenCalledOnce();
      });
    });

    it('reclaims `location` after the teardown of its render', async () => {
      const callbacks = { reclaimLocation: vi.fn() };
      const teardownRender = vi.fn();
      const render = new StoryRender(
        new Channel({}),
        buildStore(),
        callbacks as any,
        entry.id,
        'story',
        { autoplay: true },
        buildStory({ renderToCanvas: vi.fn(async () => teardownRender) })
      );

      await render.renderToElement({} as any);
      expect(callbacks.reclaimLocation).not.toHaveBeenCalled();
      await render.teardown();

      expect(callbacks.reclaimLocation).toHaveBeenCalledOnce();
      expect(teardownRender.mock.invocationCallOrder[0]).toBeLessThan(
        callbacks.reclaimLocation.mock.invocationCallOrder[0]
      );
    });

    it('does not reclaim `location` when it keeps the rendered DOM', async () => {
      const callbacks = { reclaimLocation: vi.fn() };
      const render = new StoryRender(
        new Channel({}),
        buildStore(),
        callbacks as any,
        entry.id,
        'story',
        { autoplay: true },
        buildStory()
      );

      await render.renderToElement({} as any);
      await render.teardown({ keepRenderedDom: true });

      expect(callbacks.reclaimLocation).not.toHaveBeenCalled();
    });

    it('does not reclaim `location` when torn down before it got a canvas', async () => {
      const callbacks = { reclaimLocation: vi.fn() };
      const render = new StoryRender(
        new Channel({}),
        buildStore(),
        callbacks as any,
        entry.id,
        'story',
        { autoplay: true },
        buildStory()
      );

      await render.teardown();

      expect(callbacks.reclaimLocation).not.toHaveBeenCalled();
    });

    it('lends `location` to a story with layout document until its teardown', async () => {
      const callbacks = { lendLocation: vi.fn(), reclaimLocation: vi.fn() };
      const render = new StoryRender(
        new Channel({}),
        buildStore(),
        callbacks as any,
        entry.id,
        'story',
        { autoplay: true },
        buildStory({ parameters: { layout: 'document' } })
      );

      await render.renderToElement({} as any);

      expect(callbacks.lendLocation).toHaveBeenCalledOnce();
      expect(callbacks.reclaimLocation).not.toHaveBeenCalled();

      await render.teardown();

      expect(callbacks.reclaimLocation).toHaveBeenCalledOnce();
    });

    it('does not lend `location` again when it renders after its teardown', async () => {
      const callbacks = { lendLocation: vi.fn(), reclaimLocation: vi.fn() };
      const render = new StoryRender(
        new Channel({}),
        buildStore(),
        callbacks as any,
        entry.id,
        'story',
        { autoplay: true },
        buildStory({ parameters: { layout: 'document' } })
      );
      await render.renderToElement({} as any);
      await render.teardown();

      await render.render();

      expect(callbacks.lendLocation).toHaveBeenCalledOnce();
    });

    it('does not lend `location` to a story with another layout', async () => {
      const callbacks = { lendLocation: vi.fn() };
      const render = new StoryRender(
        new Channel({}),
        buildStore(),
        callbacks as any,
        entry.id,
        'story',
        { autoplay: true },
        buildStory({ parameters: { layout: 'fullscreen' } })
      );

      await render.renderToElement({} as any);

      expect(callbacks.lendLocation).not.toHaveBeenCalled();
    });

    it('reclaims `location` before reloading', async () => {
      const [playGate] = createGate();
      const story = buildStory({ playFunction: vi.fn(() => playGate) as any });
      const callbacks = { reclaimLocation: vi.fn() };

      const render = new StoryRender(
        new Channel({}),
        buildStore(),
        callbacks as any,
        entry.id,
        'story',
        { autoplay: true },
        story
      );

      render.renderToElement({} as any);
      await vi.waitFor(() => expect(render.phase).toBe('playing'));
      render.teardown();

      await vi.waitFor(() => expect(window.location.reload).toHaveBeenCalledOnce());
      expect(callbacks.reclaimLocation).toHaveBeenCalledOnce();
      expect(callbacks.reclaimLocation.mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(window.location.reload).mock.invocationCallOrder[0]
      );
    });

    it('reloads the page when remounting during loading', async () => {
      // Arrange - setup StoryRender and async gate blocking applyLoaders
      const [loaderGate] = createGate();
      const story = buildStory({
        applyLoaders: vi.fn(() => loaderGate as any),
      });
      const store = buildStore();

      const render = new StoryRender(
        new Channel({}),
        store,
        {} as any,
        entry.id,
        'story',
        { autoplay: true },
        story
      );

      // Act - render, blocked by loaders
      render.renderToElement({} as any);
      expect(story.applyLoaders).toHaveBeenCalledOnce();
      expect(render.phase).toBe('loading');
      // Act - remount
      render.remount();

      // Assert - window is reloaded
      await vi.waitFor(() => {
        expect(window.location.reload).toHaveBeenCalledOnce();
        expect(store.cleanupStory).toHaveBeenCalledOnce();
      });
    });
  });
});

describe('StoryRender of a story that owns the document', () => {
  // A render that loads a new document leaves a new <body>, without the attributes of the old one.
  const replaceBody = () => {
    const body = document.createElement('body');
    document.documentElement.replaceChild(body, document.body);
    return body;
  };

  const buildDocumentRender = (
    overrides: Partial<PreparedStory> = {},
    callbacks: Record<string, unknown> = {},
    viewMode: 'story' | 'docs' = 'story'
  ) =>
    new StoryRender(
      new Channel({}),
      buildStore(),
      { showMain: vi.fn(), showException: vi.fn(), ...callbacks } as any,
      entry.id,
      viewMode,
      { autoplay: true },
      buildStory({ parameters: { layout: 'document' }, ...overrides })
    );

  beforeEach(() => {
    replaceBody();
  });

  it('leaves showMain to its renderer', async () => {
    const [renderGate, openRenderGate] = createGate();
    const showMain = vi.fn();
    const render = buildDocumentRender(
      {
        renderToCanvas: vi.fn(async (renderContext: RenderContext) => {
          await renderGate;
          renderContext.showMain();
        }),
      },
      { showMain }
    );

    const rendered = render.renderToElement(document.body);
    await vi.waitFor(() => expect(render.phase).toBe('rendering'));
    expect(showMain).not.toHaveBeenCalled();

    openRenderGate();
    await rendered;
    expect(showMain).toHaveBeenCalledOnce();
  });

  it('marks the body the render left as the story root and passes it to play', async () => {
    let body: HTMLElement | undefined;
    let canvasElement: unknown;
    const render = buildDocumentRender({
      renderToCanvas: vi.fn(async () => {
        body = replaceBody();
      }),
      playFunction: vi.fn((context: StoryContext) => {
        canvasElement = context.canvasElement;
      }),
    });

    await render.renderToElement(document.body);

    expect(body!.id).toBe('storybook-root');
    expect(canvasElement).toBe(body);
  });

  it('passes the body the render left to a play that mounts', async () => {
    let canvasElement: unknown;
    const render = buildDocumentRender({
      usesMount: true,
      renderToCanvas: vi.fn(async () => void replaceBody()),
      playFunction: vi.fn(async (context: StoryContext) => {
        await context.mount();
        canvasElement = context.canvasElement;
      }),
    });

    await render.renderToElement(document.body);

    expect(canvasElement).toBe(document.body);
  });

  it('marks the body again when a render strips its id', async () => {
    const render = buildDocumentRender();
    await render.renderToElement(document.body);

    document.body.removeAttribute('id');
    await tick();

    expect(document.body.id).toBe('storybook-root');
  });

  it('marks the body of every render', async () => {
    const renderToCanvas = vi.fn(async () => void replaceBody());
    const render = buildDocumentRender({ renderToCanvas });
    await render.renderToElement(document.body);
    const firstBody = document.body;

    await render.rerender();

    expect(document.body).not.toBe(firstBody);
    expect(document.body.id).toBe('storybook-root');
    expect(firstBody).not.toHaveAttribute('id');
  });

  it('renders again to the body the previous render left', async () => {
    const renderToCanvas = vi.fn(async (..._args: unknown[]) => void replaceBody());
    const render = buildDocumentRender({ renderToCanvas });
    await render.renderToElement(document.body);
    const leftBody = document.body;

    await render.rerender();

    expect(renderToCanvas.mock.calls[1][1]).toBe(leftBody);
  });

  it('marks nothing when it is torn down before its render resolves', async () => {
    const [renderGate, openRenderGate] = createGate();
    const render = buildDocumentRender({ renderToCanvas: vi.fn(() => renderGate) as any });

    render.renderToElement(document.body);
    await vi.waitFor(() => expect(render.phase).toBe('rendering'));
    render.teardown();
    openRenderGate();
    await tick();

    expect(document.body).not.toHaveAttribute('id');
  });

  it('keeps the id of a body that has one of its own, and warns once', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const renderToCanvas = vi.fn(async () => {
      document.body.id = 'app';
    });
    const render = buildDocumentRender({ renderToCanvas });

    await render.renderToElement(document.body);
    await render.rerender();

    expect(document.body.id).toBe('app');
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain('DocumentBodyHasIdError');
  });

  it('leaves the docs page alone when it renders to a block of it', async () => {
    const block = document.createElement('div');
    document.body.append(block);
    let canvasElement: unknown;
    const render = buildDocumentRender(
      {
        playFunction: vi.fn((context: StoryContext) => {
          canvasElement = context.canvasElement;
        }),
      },
      {},
      'docs'
    );

    await render.renderToElement(block);

    expect(document.body).not.toHaveAttribute('id');
    expect(canvasElement).toBe(block);
  });

  it('takes its mark back at teardown', async () => {
    const render = buildDocumentRender();
    await render.renderToElement(document.body);

    await render.teardown();

    expect(document.body).not.toHaveAttribute('id');

    document.body.id = 'app';
    document.body.removeAttribute('id');
    await tick();

    expect(document.body).not.toHaveAttribute('id');
  });
});
