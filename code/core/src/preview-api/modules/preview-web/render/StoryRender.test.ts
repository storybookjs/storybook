// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Channel } from '@storybook/core/channels';
import type { PreparedStory, Renderer, StoryContext, StoryIndexEntry } from '@storybook/core/types';

import { ReporterAPI, type StoryStore } from '../../store';
import { PREPARE_ABORTED } from './Render';
import { StoryRender } from './StoryRender';

const entry = {
  type: 'story',
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

window.location = { reload: vi.fn() } as any;

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
    applyLoaders: vi.fn(),
    applyBeforeEach: vi.fn(),
    unboundStoryFn: vi.fn(),
    playFunction: vi.fn(),
    mount: (context: StoryContext) => () => mountSpy(context),
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

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('StoryRender', () => {
  it('does run play function if passed autoplay=true', async () => {
    const story = buildStory();
    const render = new StoryRender(
      new Channel({}),
      buildStore(),
      vi.fn() as any,
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
      vi.fn() as any,
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
    const renderToScreen = vi.fn();

    const story = buildStory({
      applyLoaders: vi.fn(() => loaderGate as any),
    });
    const render = new StoryRender(
      new Channel({}),
      buildStore(),
      renderToScreen,
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
    expect(renderToScreen).not.toHaveBeenCalled();

    // Act - finish loading
    openLoaderGate();

    // Assert - loaded and rendered twice, played once
    await vi.waitFor(async () => {
      expect(story.applyLoaders).toHaveBeenCalledTimes(2);
      expect(renderToScreen).toHaveBeenCalledTimes(2);
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
      vi.fn() as any,
      {} as any,
      entry.id,
      'story',
      { autoplay: true },
      story
    );

    await render.renderToElement({} as any);
    expect(mountSpy).toHaveBeenCalledOnce();
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
      vi.fn() as any,
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
      vi.fn() as any,
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
      vi.fn() as any,
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
      vi.fn(() => {
        expect(render.phase).toBe('rendering');
      }) as any,
      {} as any,
      entry.id,
      'story',
      { autoplay: true },
      story
    );

    await render.renderToElement({} as any);
    expect(actualMount).toHaveBeenCalled();
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

      const render = new StoryRender(
        new Channel({}),
        mockStore,
        vi.fn(),
        {} as any,
        entry.id,
        'story'
      );

      const preparePromise = render.prepare();

      render.teardown();

      openImportGate();

      await expect(preparePromise).rejects.toThrowError(PREPARE_ABORTED);
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
        vi.fn() as any,
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
      // Arrange - setup StoryRender and async gate blocking renderToScreen
      const [renderGate] = createGate();
      const story = buildStory();
      const store = buildStore();
      const renderToScreen = vi.fn(() => renderGate);

      const render = new StoryRender(
        new Channel({}),
        store,
        renderToScreen as any,
        {} as any,
        entry.id,
        'story',
        { autoplay: true },
        story
      );

      // Act - render (blocked by renderToScreen), teardown
      render.renderToElement({} as any);
      await tick(); // go from 'loading' to 'rendering' phase
      expect(renderToScreen).toHaveBeenCalledOnce();
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
        vi.fn() as any,
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
        vi.fn() as any,
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
