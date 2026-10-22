// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CURRENT_STORY_WAS_SET } from 'storybook/internal/core-events';

import { mockChannel } from '../../../channels/mock-channel.ts';
import {
  FRAME_POOL_LAYOUT,
  FRAME_POOL_SHOWN,
  type FramePoolLayout,
} from '../../../shared/constants/frame-pool.ts';
import { IFRAME_RESIZE_CONTEXT } from '../../../shared/constants/iframe-resize.ts';
import { FramePoolClient } from './FramePool.ts';

// happy-dom lays nothing out: each element says where it lies.
const placeAt = (element: HTMLElement, top: number, height: number, width = 300) =>
  Object.defineProperty(element, 'getBoundingClientRect', {
    value: () => ({ top, left: 10, width, height, bottom: top + height, right: 10 + width }),
    configurable: true,
  });

const element = (parent: HTMLElement = document.body, id?: string) => {
  const child = document.createElement('div');
  if (id) {
    child.id = id;
  }
  parent.append(child);
  return child;
};

let docs: HTMLElement;
let channel: ReturnType<typeof mockChannel>;
let posted: ReturnType<typeof vi.fn<(message: any, options?: unknown) => void>>;

const layouts = () =>
  vi
    .mocked(channel.emit)
    .mock.calls.filter(([type]) => type === FRAME_POOL_LAYOUT)
    .map(([, layout]) => (layout as FramePoolLayout).slots.map(({ id, rect }) => ({ id, rect })));

const heights = () =>
  posted.mock.calls
    .map(([data]) => JSON.parse(data as string))
    .filter(({ context }) => context === IFRAME_RESIZE_CONTEXT)
    .map(({ height }) => height);

// Lets the client report.
const frame = () => vi.advanceTimersByTimeAsync(20);

// The clients of earlier tests still listen: they report no more.
const clients: FramePoolClient[] = [];

const createClient = () => {
  const client = new FramePoolClient(channel);
  clients.push(client);
  vi.spyOn(channel, 'emit');
  return client;
};

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'performance'],
  });
  vi.stubGlobal('innerHeight', 800);
  channel = mockChannel();
  posted = vi.fn<(message: any, options?: unknown) => void>();
  vi.spyOn(window, 'postMessage').mockImplementation(posted);
  docs = element(document.body, 'storybook-docs');
  placeAt(docs, 0, 2_000);
});

afterEach(() => {
  clients.splice(0).forEach((client) => Object.assign(client, { report: () => {} }));
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('FramePoolClient', () => {
  it('reports the story blocks of the docs page and its height, only when they change', async () => {
    const client = createClient();
    const place = element(docs);
    placeAt(place, 400, 200);
    client.lease({ storyId: 'a--one', globals: {}, autoplay: true, place });
    await frame();

    expect(layouts()).toEqual([
      [{ id: '1', rect: { top: 400, left: 10, width: 300, height: 200 } }],
    ]);
    expect(heights()).toEqual([2_000]);

    element(docs);
    await frame();
    expect(layouts()).toHaveLength(1);
    expect(heights()).toHaveLength(1);
  });

  it('skips a story block that takes no room', async () => {
    const client = createClient();
    const collapsed = element(docs);
    placeAt(collapsed, 400, 0, 0);
    const open = element(docs);
    placeAt(open, 900, 200);
    client.lease({ storyId: 'a--one', globals: {}, autoplay: true, place: collapsed });
    client.lease({ storyId: 'a--two', globals: {}, autoplay: true, place: open });
    await frame();

    expect(layouts()).toEqual([
      [{ id: '2', rect: { top: 900, left: 10, width: 300, height: 200 } }],
    ]);
  });

  it('tells a lease when a frame shows its story', async () => {
    const client = createClient();
    const onShow = vi.fn();
    client.lease({ storyId: 'a--one', globals: {}, autoplay: true, place: element(docs), onShow });
    channel.emit(FRAME_POOL_SHOWN, { id: '1', shown: true });

    expect(onShow).toHaveBeenCalledWith(true);
  });

  it('reports again once the preview set a story, as the manager forgot what it reported', async () => {
    const client = createClient();
    const place = element(docs);
    placeAt(place, 400, 200);
    client.lease({ storyId: 'a--one', globals: {}, autoplay: true, place });
    await frame();

    channel.emit(CURRENT_STORY_WAS_SET, { storyId: 'a--docs', viewMode: 'docs' });
    await frame();

    expect(layouts()).toHaveLength(2);
    expect(heights()).toEqual([2_000, 2_000]);
  });

  it('does not follow content that grows with the window', async () => {
    const client = createClient();
    // Something on the page changed: a block that takes no room comes, which the client measures.
    const change = () => {
      const place = element(docs);
      placeAt(place, 0, 0, 0);
      client.lease({ storyId: 'a--one', globals: {}, autoplay: true, place });
    };
    placeAt(docs, 0, 840);
    change();
    await frame();
    expect(heights()).toEqual([840]);

    // The manager sizes the frame to the report, and the content, at least as tall as the window
    // and some, grows with it.
    vi.stubGlobal('innerHeight', 840);
    window.dispatchEvent(new Event('resize'));
    placeAt(docs, 0, 880);
    change();
    await frame();
    expect(heights()).toEqual([840]);

    // Content that grows later is followed.
    await vi.advanceTimersByTimeAsync(1_000);
    placeAt(docs, 0, 1_200);
    change();
    await frame();
    expect(heights()).toEqual([840, 1_200]);
  });
});
