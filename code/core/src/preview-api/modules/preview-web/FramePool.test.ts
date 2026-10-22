// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  SET_CURRENT_STORY,
  STORY_RENDER_PHASE_CHANGED,
  UPDATE_GLOBALS,
} from 'storybook/internal/core-events';

import { parse, stringify } from 'telejson';

import { KEY } from '../../../channels/postmessage/index.ts';
import { FramePool } from './FramePool.ts';

// The frames' previews are what the tests play: happy-dom loads no page in them.
(
  window as unknown as { happyDOM: { settings: { disableIframePageLoading: boolean } } }
).happyDOM.settings.disableIframePageLoading = true;

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

const framesOf = () =>
  Array.from(document.querySelectorAll<HTMLIFrameElement>('[data-storybook-frame-pool] iframe'));

// The frame's window, which the tests play, and what the pool posted to it as channel events.
const posted = (iframe: HTMLIFrameElement) => {
  const events: { type: string; args: unknown[] }[] = [];
  const postMessage = (data: unknown) => {
    events.push((parse(data as string) as { event: { type: string; args: unknown[] } }).event);
  };
  Object.defineProperty(iframe, 'contentWindow', { value: { postMessage }, configurable: true });
  return events;
};

// The frame's preview reports a phase of its render.
const report = (iframe: HTMLIFrameElement, storyId: string, newPhase: string) =>
  window.dispatchEvent(
    new MessageEvent('message', {
      data: stringify({
        key: KEY,
        event: { type: STORY_RENDER_PHASE_CHANGED, args: [{ storyId, newPhase }] },
      }),
      origin: location.origin,
      source: iframe.contentWindow,
    })
  );

// Each frame's preview renders its first story, one frame after the other.
const bootAll = async () => {
  const booted = new Set<HTMLIFrameElement>();
  for (let round = 0; round < 10; round++) {
    await settle();
    for (const frame of framesOf().filter((candidate) => !booted.has(candidate))) {
      booted.add(frame);
      posted(frame);
      report(frame, new URL(frame.src, location.href).searchParams.get('id')!, 'finished');
    }
  }
};

const place = () => {
  const element = document.createElement('div');
  document.body.append(element);
  return element;
};

afterEach(() => {
  document.documentElement.querySelector('[data-storybook-frame-pool]')?.remove();
  document.body.replaceChildren();
});

describe('FramePool', () => {
  it('boots a frame on the story, and shows it once its preview rendered it', async () => {
    const pool = new FramePool(2, Infinity);
    const onShow = vi.fn();
    pool.lease({ storyId: 'a--one', globals: {}, autoplay: true, place: place(), onShow });
    await settle();

    const [frame] = framesOf();
    posted(frame);
    expect(new URL(frame.src, location.href).searchParams.get('id')).toBe('a--one');
    expect(onShow).not.toHaveBeenCalled();

    report(frame, 'a--one', 'finished');
    await settle();
    expect(onShow).toHaveBeenCalledWith(true);
    expect(frame.style.visibility).toBe('visible');
  });

  it('switches a free frame to the next story with SET_CURRENT_STORY, keeping its src', async () => {
    const pool = new FramePool(1, 1);
    const first = pool.lease({ storyId: 'a--one', globals: {}, autoplay: true, place: place() });
    await settle();
    const [frame] = framesOf();
    const src = frame.src;
    const events = posted(frame);
    report(frame, 'a--one', 'finished');
    await settle();

    first.release();
    pool.lease({ storyId: 'a--two', globals: {}, autoplay: false, place: place() });
    await settle();

    expect(framesOf()).toEqual([frame]);
    expect(frame.src).toBe(src);
    expect(events).toEqual([
      {
        type: SET_CURRENT_STORY,
        args: [{ storyId: 'a--two', viewMode: 'story', autoplay: false }],
        from: 'frame-pool',
      },
    ]);
  });

  it('never switches a frame whose render still runs', async () => {
    const pool = new FramePool(1, 1);
    const first = pool.lease({ storyId: 'a--one', globals: {}, autoplay: true, place: place() });
    await settle();
    const [frame] = framesOf();
    const events = posted(frame);

    first.release();
    pool.lease({ storyId: 'a--two', globals: {}, autoplay: true, place: place() });
    await settle();
    expect(events).toEqual([]);

    report(frame, 'a--one', 'finished');
    await settle();
    expect(events.map(({ type }) => type)).toEqual([SET_CURRENT_STORY]);
  });

  it('renders new globals before it switches the story', async () => {
    const pool = new FramePool(1, 1);
    const first = pool.lease({ storyId: 'a--one', globals: {}, autoplay: true, place: place() });
    await settle();
    const [frame] = framesOf();
    const events = posted(frame);
    report(frame, 'a--one', 'finished');
    await settle();

    first.release();
    pool.lease({ storyId: 'a--two', globals: { locale: 'nl' }, autoplay: true, place: place() });
    await settle();
    expect(events.map(({ type }) => type)).toEqual([UPDATE_GLOBALS]);

    report(frame, 'a--one', 'finished');
    await settle();
    expect(events.map(({ type }) => type)).toEqual([UPDATE_GLOBALS, SET_CURRENT_STORY]);
  });

  it('grows past its size for every story in view, and no further', async () => {
    const pool = new FramePool(2, Infinity);
    for (const storyId of ['a--1', 'a--2', 'a--3', 'a--4']) {
      pool.lease({ storyId, globals: {}, autoplay: true, place: place() });
    }
    await bootAll();
    expect(framesOf()).toHaveLength(4);
  });

  it('boots one frame at a time', async () => {
    const pool = new FramePool(2, Infinity);
    pool.lease({ storyId: 'a--1', globals: {}, autoplay: true, place: place() });
    pool.lease({ storyId: 'a--2', globals: {}, autoplay: true, place: place() });
    await settle();
    expect(framesOf()).toHaveLength(1);

    const [first] = framesOf();
    posted(first);
    report(first, 'a--1', 'finished');
    await settle();
    expect(framesOf()).toHaveLength(2);
  });

  it('keeps to its most, also with more stories in view', async () => {
    const pool = new FramePool(2, 2);
    for (const storyId of ['a--1', 'a--2', 'a--3', 'a--4']) {
      pool.lease({ storyId, globals: {}, autoplay: true, place: place() });
    }
    await bootAll();
    expect(framesOf()).toHaveLength(2);
  });
});
