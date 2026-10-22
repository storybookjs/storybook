// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChannelEvent } from 'storybook/internal/channels';
import {
  CURRENT_STORY_WAS_SET,
  DOCS_RENDERED,
  SET_CURRENT_STORY,
  SET_GLOBALS,
  STORY_ARGS_UPDATED,
  STORY_CHANGED,
  STORY_PREPARED,
  STORY_RENDER_PHASE_CHANGED,
  UPDATE_STORY_ARGS,
} from 'storybook/internal/core-events';

import { parse, stringify } from 'telejson';

import { KEY } from '../../../channels/postmessage/index.ts';
import {
  FRAME_POOL_LAYOUT,
  FRAME_POOL_SHOWN,
  type FramePoolSlot,
  POOL_FRAME_REPLAY_ATTRIBUTE,
} from '../../../shared/constants/frame-pool.ts';
import { ACTIVE_FRAME_ID, FramePool, type FramePoolDeps } from './FramePool.ts';
import { SERVICE_SYNC_REQUEST } from '../../../shared/open-service/service-channel.ts';
import { framePoolSrc } from './FramePoolHost.tsx';

type Posted = { type: string; args: unknown[] };

// Each frame's window, which the tests play, with what the pool posted to it.
const windows = new WeakMap<HTMLIFrameElement, { postMessage: (data: string) => void }>();
const posts = new WeakMap<HTMLIFrameElement, Posted[]>();

const windowOf = (iframe: HTMLIFrameElement) => {
  if (!windows.has(iframe)) {
    const events: Posted[] = [];
    posts.set(iframe, events);
    windows.set(iframe, {
      postMessage: (data) => events.push((parse(data) as { event: Posted }).event),
    });
  }
  return windows.get(iframe)!;
};

const postedTo = (iframe: HTMLIFrameElement) => (windowOf(iframe), posts.get(iframe)!);

// The frame's preview says something on the channel.
const say = (iframe: HTMLIFrameElement, type: string, ...args: unknown[]) =>
  window.dispatchEvent(
    new MessageEvent('message', {
      data: stringify({ key: KEY, event: { type, args } }),
      origin: location.origin,
      source: windowOf(iframe) as unknown as Window,
    })
  );

const renderStory = (
  iframe: HTMLIFrameElement,
  storyId: string,
  phases = ['rendering', 'finished']
) => {
  say(iframe, CURRENT_STORY_WAS_SET, { storyId, viewMode: 'story' });
  phases.forEach((newPhase) =>
    say(iframe, STORY_RENDER_PHASE_CHANGED, { storyId, renderId: 1, newPhase })
  );
};

const renderDocs = (iframe: HTMLIFrameElement, docsId: string, slots: FramePoolSlot[]) => {
  say(iframe, CURRENT_STORY_WAS_SET, { storyId: docsId, viewMode: 'docs' });
  say(iframe, DOCS_RENDERED, docsId);
  say(iframe, FRAME_POOL_LAYOUT, { slots });
};

const slot = (id: string, storyId: string, top: number): FramePoolSlot => ({
  id,
  storyId,
  globals: {},
  autoplay: true,
  rect: { top, left: 10, width: 300, height: 200 },
});

const slotAt = (id: string, storyId: string, top: number, height = 200): FramePoolSlot => ({
  ...slot(id, storyId, top),
  rect: { top, left: 10, width: 300, height },
});

const typesOf = (events: { type: string }[]) => events.map(({ type }) => type);

const storyIdOf = (iframe: HTMLIFrameElement) =>
  new URL(iframe.src).searchParams.get('id') ?? undefined;

let container: HTMLElement;

const framesOf = () => Array.from(container.querySelectorAll('iframe'));
const activeFrame = () => container.querySelector<HTMLIFrameElement>(`#${ACTIVE_FRAME_ID}`);

const createPool = (deps: Partial<FramePoolDeps> = {}) => {
  const pool = new FramePool({
    size: 1,
    max: Number.POSITIVE_INFINITY,
    // happy-dom loads no `iframe.html`.
    src: (entry) => `about:blank?id=${entry.id}&viewMode=${entry.viewMode}`,
    userGlobals: () => ({}),
    hasPlay: () => false,
    firstStory: () => 'a--one',
    receive: vi.fn(),
    ...deps,
  });
  // happy-dom lays nothing out: the host shows the top 800 pixels of a docs page.
  Object.defineProperty(pool.host, 'clientHeight', { value: 800 });
  pool.attach(container);
  return pool;
};

// Lets the pool pump, and its frames go quiet.
const tick = (ms = 300) => vi.advanceTimersByTimeAsync(ms);

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'performance',
    ],
  });
  vi.spyOn(HTMLIFrameElement.prototype, 'contentWindow', 'get').mockImplementation(function (
    this: HTMLIFrameElement
  ) {
    return windowOf(this) as unknown as Window;
  });
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('FramePool', () => {
  it('shows a story in a frame that boots on it, as the preview the channel speaks to', async () => {
    const pool = createPool();
    pool.select({ id: 'a--one', viewMode: 'story' });
    await tick();

    expect(framesOf()).toHaveLength(1);
    expect(activeFrame()).toBe(framesOf()[0]);
    expect(storyIdOf(framesOf()[0])).toBe('a--one');
    expect(activeFrame()?.dataset.isStorybook).toBe('true');
  });

  it('warms `size` frames one after the other once the first one rendered', async () => {
    const pool = createPool({ size: 2 });
    pool.select({ id: 'a--one', viewMode: 'story' });
    renderStory(framesOf()[0], 'a--one');
    await tick(1_500);

    const [, warm] = framesOf();
    expect(framesOf()).toHaveLength(2);
    expect(warm.dataset.isStorybook).toBe('false');
    expect(warm.style.visibility).toBe('hidden');

    await tick(1_500);
    expect(framesOf()).toHaveLength(2);
  });

  it('switches a free frame to the next story, but only once its render ended', async () => {
    const pool = createPool({ max: 1 });
    pool.select({ id: 'a--one', viewMode: 'story' });
    const [frame] = framesOf();
    renderStory(frame, 'a--one', ['rendering', 'playing']);
    await tick();

    pool.select({ id: 'b--two', viewMode: 'story' });
    await tick(200);
    expect(postedTo(frame).filter(({ type }) => type === SET_CURRENT_STORY)).toEqual([]);

    say(frame, STORY_RENDER_PHASE_CHANGED, {
      storyId: 'a--one',
      renderId: 1,
      newPhase: 'finished',
    });
    await tick();

    expect(framesOf()).toEqual([frame]);
    expect(postedTo(frame).filter(({ type }) => type === SET_CURRENT_STORY)).toEqual([
      {
        type: SET_CURRENT_STORY,
        args: [{ storyId: 'b--two', viewMode: 'story', autoplay: true, globals: {} }],
        from: 'frame-pool',
      },
    ]);
    expect(activeFrame()).toBe(frame);
  });

  it('lays frames over the story blocks of the docs page, and tells the page', async () => {
    const pool = createPool({ size: 1 });
    pool.select({ id: 'a--docs', viewMode: 'docs' });
    const [docs] = framesOf();
    renderDocs(docs, 'a--docs', [slot('1', 'a--one', 100), slot('2', 'a--two', 400)]);
    await tick();

    // One frame boots at a time.
    for (const storyId of ['a--one', 'a--two']) {
      const frame = framesOf().find((candidate) => storyIdOf(candidate) === storyId)!;
      renderStory(frame, storyId);
      await tick();
    }

    const [, first, second] = framesOf();
    expect(framesOf()).toHaveLength(3);
    expect(activeFrame()).toBe(docs);
    expect(first.style.top).toBe('100px');
    expect(second.style.top).toBe('400px');
    expect([first, second].map((frame) => frame.style.visibility)).toEqual(['visible', 'visible']);
    expect(postedTo(docs).filter(({ type }) => type === FRAME_POOL_SHOWN)).toEqual([
      expect.objectContaining({ args: [{ id: '1', shown: true }] }),
      expect.objectContaining({ args: [{ id: '2', shown: true }] }),
    ]);
  });

  it('keeps to `max` frames, the docs page included', async () => {
    const pool = createPool({ size: 1, max: 2 });
    pool.select({ id: 'a--docs', viewMode: 'docs' });
    const [docs] = framesOf();
    renderDocs(docs, 'a--docs', [
      slot('1', 'a--one', 0),
      slot('2', 'a--two', 250),
      slot('3', 'a--three', 500),
    ]);
    for (let round = 0; round < 5; round++) {
      await tick();
      framesOf()
        .slice(1)
        .forEach((frame) => renderStory(frame, storyIdOf(frame)!));
    }

    expect(framesOf()).toHaveLength(2);
  });

  it('shows a story the docs page showed in the same frame, and replays what it reported', async () => {
    const receive = vi.fn<(event: ChannelEvent) => void>();
    const pool = createPool({ receive });
    pool.select({ id: 'a--docs', viewMode: 'docs' });
    const [docs] = framesOf();
    renderDocs(docs, 'a--docs', [slot('1', 'a--one', 100)]);
    await tick();
    const story = framesOf()[1];
    renderStory(story, 'a--one');
    await tick();

    pool.select({ id: 'a--one', viewMode: 'story' });

    expect(framesOf()).toEqual([docs, story]);
    expect(activeFrame()).toBe(story);
    expect(docs.style.visibility).toBe('hidden');
    expect(postedTo(story).filter(({ type }) => type === SET_CURRENT_STORY)).toEqual([]);
    // The manager hears the frame's events once it rendered the story view.
    expect(story.hasAttribute(POOL_FRAME_REPLAY_ATTRIBUTE)).toBe(true);
    expect(receive).not.toHaveBeenCalled();

    await tick(0);
    expect(story.hasAttribute(POOL_FRAME_REPLAY_ATTRIBUTE)).toBe(false);
    const heard = receive.mock.calls.map(([event]) => event.type);
    expect(heard).toEqual([
      STORY_CHANGED,
      CURRENT_STORY_WAS_SET,
      STORY_RENDER_PHASE_CHANGED,
      STORY_RENDER_PHASE_CHANGED,
    ]);
  });

  it('boots a frame that reloaded before it uses it again', async () => {
    const pool = createPool({ max: 1 });
    pool.select({ id: 'a--one', viewMode: 'story' });
    const [frame] = framesOf();
    frame.dispatchEvent(new Event('load'));
    renderStory(frame, 'a--one');
    await tick();

    // The preview reloaded, and renders the story again.
    frame.dispatchEvent(new Event('load'));
    pool.select({ id: 'b--two', viewMode: 'story' });
    await tick(200);
    expect(postedTo(frame).filter(({ type }) => type === SET_CURRENT_STORY)).toEqual([]);

    renderStory(frame, 'a--one');
    await tick();
    expect(postedTo(frame).filter(({ type }) => type === SET_CURRENT_STORY)).toHaveLength(1);
  });

  it('never moves a frame in the document or changes its src', async () => {
    const pool = createPool();
    pool.select({ id: 'a--one', viewMode: 'story' });
    const [frame] = framesOf();
    const { src } = frame;
    renderStory(frame, 'a--one');
    await tick();
    const moved = vi.fn();
    new MutationObserver(moved).observe(pool.host, { childList: true });

    pool.select({ id: 'b--two', viewMode: 'story' });
    await tick();
    renderStory(frame, 'b--two');
    await tick();

    expect(frame.src).toBe(src);
    expect(moved).not.toHaveBeenCalled();
  });

  it('never switches a frame whose render never ends: the page shown gets a new one', async () => {
    const pool = createPool({ max: 1 });
    pool.select({ id: 'a--one', viewMode: 'story' });
    const [frame] = framesOf();
    renderStory(frame, 'a--one', ['rendering', 'playing']);
    await tick();

    pool.select({ id: 'b--two', viewMode: 'story' });
    await tick(60_000);

    expect(typesOf(postedTo(frame))).not.toContain(SET_CURRENT_STORY);
    expect(frame.isConnected).toBe(false);
    expect(framesOf()).toHaveLength(1);
    expect(storyIdOf(activeFrame()!)).toBe('b--two');
  });

  it('takes the frame of the story farthest from the screen for one that comes in view', async () => {
    const pool = createPool({ max: 3 });
    pool.select({ id: 'a--docs', viewMode: 'docs' });
    const [docs] = framesOf();
    renderDocs(docs, 'a--docs', [
      slot('1', 'a--one', 0),
      slot('2', 'a--two', 300),
      slot('3', 'a--three', 2_000),
    ]);
    for (let round = 0; round < 3; round++) {
      await tick();
      framesOf()
        .slice(1)
        .forEach((frame) => renderStory(frame, storyIdOf(frame)!));
    }
    const [, first, second] = framesOf();
    expect(framesOf()).toHaveLength(3);

    pool.host.scrollTop = 1_900;
    pool.host.dispatchEvent(new Event('scroll'));
    await tick();

    expect(framesOf()).toHaveLength(3);
    expect(postedTo(first).filter(({ type }) => type === SET_CURRENT_STORY)).toEqual([
      expect.objectContaining({ args: [expect.objectContaining({ storyId: 'a--three' })] }),
    ]);
    expect(typesOf(postedTo(second))).not.toContain(SET_CURRENT_STORY);
  });

  it('gives no frame to a story block that takes no room', async () => {
    const pool = createPool();
    pool.select({ id: 'a--docs', viewMode: 'docs' });
    const [docs] = framesOf();
    renderDocs(docs, 'a--docs', [slotAt('1', 'a--one', 100, 0)]);
    await tick(2_000);

    expect(framesOf()).toEqual([docs]);
  });

  it('keeps its host where it was attached, and its frames in it', async () => {
    const pool = createPool();
    pool.select({ id: 'a--one', viewMode: 'story' });
    const [frame] = framesOf();
    const moved = vi.fn();
    new MutationObserver(moved).observe(container, { childList: true, subtree: true });

    pool.attach(container);
    await tick();

    expect(pool.host.parentElement).toBe(container);
    expect(framesOf()).toEqual([frame]);
    expect(moved).not.toHaveBeenCalled();
  });

  it('holds a switched frame until its preview set the story, so its last story is not heard', async () => {
    const receive = vi.fn<(event: ChannelEvent) => void>();
    const pool = createPool({ receive });
    pool.select({ id: 'a--one', viewMode: 'story' });
    const [frame] = framesOf();
    renderStory(frame, 'a--one');
    await tick();

    pool.select({ id: 'b--two', viewMode: 'story' });
    await tick();
    expect(activeFrame()).toBe(frame);
    expect(frame.hasAttribute(POOL_FRAME_REPLAY_ATTRIBUTE)).toBe(true);

    receive.mockClear();
    say(frame, STORY_RENDER_PHASE_CHANGED, { storyId: 'a--one', renderId: 1, newPhase: 'aborted' });
    say(frame, CURRENT_STORY_WAS_SET, { storyId: 'b--two', viewMode: 'story' });
    say(frame, STORY_RENDER_PHASE_CHANGED, { storyId: 'b--two', renderId: 2, newPhase: 'loading' });
    expect(receive).not.toHaveBeenCalled();

    await tick(0);
    expect(frame.hasAttribute(POOL_FRAME_REPLAY_ATTRIBUTE)).toBe(false);
    expect(typesOf(receive.mock.calls.map(([event]) => event))).toEqual([
      CURRENT_STORY_WAS_SET,
      STORY_RENDER_PHASE_CHANGED,
    ]);
  });

  it('hands the manager what the frame says before the replay, after the replay', async () => {
    const receive = vi.fn<(event: ChannelEvent) => void>();
    const pool = createPool({ receive });
    pool.select({ id: 'a--docs', viewMode: 'docs' });
    const [docs] = framesOf();
    renderDocs(docs, 'a--docs', [slot('1', 'a--one', 100)]);
    await tick();
    const story = framesOf()[1];
    renderStory(story, 'a--one');
    await tick();

    pool.select({ id: 'a--one', viewMode: 'story' });
    say(story, 'live', 1);
    expect(receive).not.toHaveBeenCalled();
    await tick(0);

    expect(typesOf(receive.mock.calls.map(([event]) => event))).toEqual([
      STORY_CHANGED,
      CURRENT_STORY_WAS_SET,
      STORY_RENDER_PHASE_CHANGED,
      STORY_RENDER_PHASE_CHANGED,
      'live',
    ]);
  });

  it('keeps the lifecycle of a selection when its log is full', async () => {
    const receive = vi.fn<(event: ChannelEvent) => void>();
    const pool = createPool({ receive });
    pool.select({ id: 'a--docs', viewMode: 'docs' });
    const [docs] = framesOf();
    renderDocs(docs, 'a--docs', [slot('1', 'a--one', 100)]);
    await tick();
    const story = framesOf()[1];
    renderStory(story, 'a--one');
    for (let index = 0; index < 2_100; index++) {
      say(story, 'noise', index);
    }
    await tick();

    pool.select({ id: 'a--one', viewMode: 'story' });
    await tick(0);

    const heard = receive.mock.calls.map(([event]) => event);
    expect(typesOf(heard.slice(0, 2))).toEqual([STORY_CHANGED, CURRENT_STORY_WAS_SET]);
    expect(heard.at(-1)?.args).toEqual([2_099]);
    expect(heard.length).toBeLessThanOrEqual(2_001);
  });

  it('tells the manager the global types and sync requests of a frame it did not hear', async () => {
    const receive = vi.fn<(event: ChannelEvent) => void>();
    const pool = createPool({ receive, max: 1 });
    pool.select({ id: 'a--one', viewMode: 'story' });
    const [frame] = framesOf();
    // The reader leaves before the preview booted.
    pool.select({ id: 'b--two', viewMode: 'story' });
    say(frame, SET_GLOBALS, { globals: {}, globalTypes: { theme: {} } });
    say(frame, SERVICE_SYNC_REQUEST, { serviceId: 'core/docs', runtimeId: 'frame', frontier: {} });
    renderStory(frame, 'a--one');
    await tick();
    renderStory(frame, 'b--two');
    await tick();

    const heard = receive.mock.calls.map(([event]) => event);
    expect(heard.filter(({ type }) => type === SET_GLOBALS)).toEqual([
      expect.objectContaining({ args: [{ globals: {}, globalTypes: { theme: {} } }] }),
    ]);
    expect(heard.filter(({ type }) => type === SERVICE_SYNC_REQUEST)).toEqual([
      expect.objectContaining({ args: [expect.objectContaining({ serviceId: 'core/docs' })] }),
    ]);
  });

  it('shows a story with the args the manager last heard, also in another frame', async () => {
    const pool = createPool();
    pool.select({ id: 'a--one', viewMode: 'story' });
    const [first] = framesOf();
    say(first, CURRENT_STORY_WAS_SET, { storyId: 'a--one', viewMode: 'story' });
    say(first, STORY_PREPARED, { id: 'a--one', args: { label: 'Hi', size: 1 } });
    renderStory(first, 'a--one');
    say(first, STORY_ARGS_UPDATED, { storyId: 'a--one', args: { label: 'Edited' } });
    await tick();

    pool.select({ id: 'a--docs', viewMode: 'docs' });
    await tick();
    renderDocs(first, 'a--docs', [slot('1', 'a--one', 100)]);
    await tick();
    const second = framesOf()[1];
    say(second, STORY_PREPARED, { id: 'a--one', args: { label: 'Hi', size: 1 } });
    renderStory(second, 'a--one');
    await tick();

    pool.select({ id: 'a--one', viewMode: 'story' });
    await tick();

    expect(activeFrame()).toBe(second);
    expect(postedTo(second).filter(({ type }) => type === UPDATE_STORY_ARGS)).toEqual([
      expect.objectContaining({
        args: [{ storyId: 'a--one', updatedArgs: { label: 'Edited', size: undefined } }],
      }),
    ]);
  });

  it('finds a docs page scrolled where the reader left it', async () => {
    const pool = createPool({ size: 2 });
    pool.select({ id: 'a--docs', viewMode: 'docs' });
    const [docs] = framesOf();
    renderDocs(docs, 'a--docs', []);
    await tick(1_500);
    const warm = framesOf()[1];
    renderStory(warm, 'a--one');
    await tick();
    pool.host.scrollTop = 1_234;

    pool.select({ id: 'a--one', viewMode: 'story' });
    await tick();
    expect(activeFrame()).toBe(warm);
    expect(pool.host.scrollTop).toBe(0);

    pool.select({ id: 'a--docs', viewMode: 'docs' });
    await tick();

    expect(activeFrame()).toBe(docs);
    expect(pool.host.scrollTop).toBe(1_234);
  });

  it('shrinks back to `size` once frames are no longer needed', async () => {
    const pool = createPool();
    pool.select({ id: 'a--docs', viewMode: 'docs' });
    const [docs] = framesOf();
    renderDocs(docs, 'a--docs', [slot('1', 'a--one', 100), slot('2', 'a--two', 400)]);
    for (let round = 0; round < 3; round++) {
      await tick();
      framesOf()
        .slice(1)
        .forEach((frame) => renderStory(frame, storyIdOf(frame)!));
    }
    expect(framesOf()).toHaveLength(3);

    pool.select({ id: 'a--one', viewMode: 'story' });
    await tick(5_000);
    expect(framesOf()).toHaveLength(3);

    await tick(6_000);
    expect(framesOf()).toHaveLength(1);
    expect(activeFrame()).toBe(framesOf()[0]);
    expect(storyIdOf(framesOf()[0])).toBe('a--one');
  });
  it('evicts hidden docs frames under `mobileMax`, for the page shown and for its stories', async () => {
    const pool = createPool({ max: 2 });
    // A docs page whose inline story never ends its render.
    pool.select({ id: 'a--docs', viewMode: 'docs' });
    const [first] = framesOf();
    renderDocs(first, 'a--docs', []);
    say(first, STORY_RENDER_PHASE_CHANGED, {
      storyId: 'a--inline',
      renderId: 1,
      newPhase: 'rendering',
    });
    await tick();

    // The next page gets a frame of its own, once the frame of the last one did not go quiet.
    pool.select({ id: 'b--docs', viewMode: 'docs' });
    await tick(350);
    const [, second] = framesOf();
    expect(activeFrame()).toBe(second);
    say(second, STORY_RENDER_PHASE_CHANGED, {
      storyId: 'b--inline',
      renderId: 1,
      newPhase: 'rendering',
    });
    renderDocs(second, 'b--docs', [slot('1', 'b--one', 100)]);
    await tick();

    // Its story in view gets the frame of the hidden docs page, which never goes idle.
    await tick(1_000);
    expect(first.isConnected).toBe(false);
    const third = framesOf().find((frame) => frame !== second)!;
    expect(storyIdOf(third)).toBe('b--one');
    expect(framesOf()).toHaveLength(2);

    // The page shown next does not wait either, when no frame goes idle: the one shown least
    // recently goes, and the page last shown stays on the screen until the next one shows.
    renderStory(third, 'b--one', ['rendering', 'playing']);
    await tick();
    pool.select({ id: 'c--docs', viewMode: 'docs' });
    await tick(1_500);
    expect(third.isConnected).toBe(false);
    expect(second.isConnected).toBe(true);
    expect(storyIdOf(activeFrame()!)).toBe('c--docs');
    expect(framesOf()).toHaveLength(2);
  });
});

describe('framePoolSrc', () => {
  const api = { getStoryHrefs: vi.fn(() => ({ managerHref: '', previewHref: 'iframe.html' })) };
  const queryParams = { args: 'label:Edited', custom: 'yes' };

  it('gives the args of the URL to the selected story only', () => {
    framePoolSrc(
      api,
      { queryParams },
      { id: 'a--one', viewMode: 'story' },
      {
        autoplay: true,
        selected: true,
      }
    );
    framePoolSrc(
      api,
      { queryParams },
      { id: 'a--two', viewMode: 'story' },
      {
        autoplay: false,
        selected: false,
      }
    );

    expect(api.getStoryHrefs.mock.calls).toEqual([
      [
        'a--one',
        {
          queryParams: { custom: 'yes', framePool: 'frame' },
          refId: undefined,
          viewMode: 'story',
        },
      ],
      [
        'a--two',
        {
          queryParams: { custom: 'yes', framePool: 'frame', autoplay: 'false' },
          inheritArgs: false,
          refId: undefined,
          viewMode: 'story',
        },
      ],
    ]);
  });
});
