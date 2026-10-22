// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChannelEvent } from 'storybook/internal/channels';
import {
  CURRENT_STORY_WAS_SET,
  DOCS_RENDERED,
  SET_CURRENT_STORY,
  STORY_CHANGED,
  STORY_RENDER_PHASE_CHANGED,
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

const storyIdOf = (iframe: HTMLIFrameElement) =>
  new URL(iframe.src).searchParams.get('id') ?? undefined;

let host: HTMLElement;

const framesOf = () => Array.from(host.querySelectorAll('iframe'));
const activeFrame = () => host.querySelector<HTMLIFrameElement>(`#${ACTIVE_FRAME_ID}`);

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
  pool.attach(host);
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
  host = document.createElement('div');
  // happy-dom lays nothing out: the host shows the top 800 pixels of a docs page.
  Object.defineProperty(host, 'clientHeight', { value: 800 });
  document.body.append(host);
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
    const pool = createPool();
    pool.select({ id: 'a--one', viewMode: 'story' });
    const [frame] = framesOf();
    renderStory(frame, 'a--one', ['rendering', 'playing']);
    await tick();

    pool.select({ id: 'b--two', viewMode: 'story' });
    await tick(2_000);
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
    const pool = createPool();
    pool.select({ id: 'a--one', viewMode: 'story' });
    const [frame] = framesOf();
    frame.dispatchEvent(new Event('load'));
    renderStory(frame, 'a--one');
    await tick();

    // The preview reloaded, and renders the story again.
    frame.dispatchEvent(new Event('load'));
    pool.select({ id: 'b--two', viewMode: 'story' });
    await tick(2_000);
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
    new MutationObserver(moved).observe(host, { childList: true });

    pool.select({ id: 'b--two', viewMode: 'story' });
    await tick();
    renderStory(frame, 'b--two');
    await tick();

    expect(frame.src).toBe(src);
    expect(moved).not.toHaveBeenCalled();
  });
});
