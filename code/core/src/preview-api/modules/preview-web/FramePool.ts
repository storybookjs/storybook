import {
  SET_CURRENT_STORY,
  STORY_RENDER_PHASE_CHANGED,
  UPDATE_GLOBALS,
} from 'storybook/internal/core-events';
import type { Globals, Parameters, StoryId } from 'storybook/internal/types';

import { isJSON, parse, stringify } from 'telejson';

import { KEY } from '../../../channels/postmessage/index.ts';

/**
 * The previews of `features.experimentalFramePool`. A story that needs a document of its own, one
 * that docs show in an iframe, boots a whole preview to render: the code of the stories, and for a
 * framework that renders on a server in the browser, that server too. The pool keeps a few such
 * previews for as long as this one lives, and the story view and the docs pages borrow them: a
 * preview switches from story to story with `SET_CURRENT_STORY`, as the manager switches this one.
 *
 * A frame of the pool never reloads. It is never moved in the document, which would load it again,
 * but lies in a layer of its own next to `<body>`, which a story that owns the document swaps, over
 * the place of the story that borrows it. It never gets a new `src`. And it switches story only
 * once its render ended: a preview that tears down a render that still runs reloads itself.
 */

export const FRAME_POOL_PARAM = 'framePool';

const RENDER_TIMEOUT = 30_000;
const ENDED_PHASES = ['finished', 'errored', 'aborted'];

export interface FrameEvent {
  type: string;
  args: unknown[];
}

export interface FrameLeaseRequest {
  storyId: StoryId;
  globals: Globals;
  autoplay: boolean;
  /** Where the story shows. Without a place, it fills the window, as the story view does. */
  place?: HTMLElement;
  /** Called with `true` once a frame shows the story, and `false` when it went to a nearer one. */
  onShow?: (shown: boolean) => void;
  /** The channel events of the frame's preview while it shows the story. */
  onEvent?: (event: FrameEvent) => void;
}

export interface FrameLease {
  /** Sends a channel event to the preview that shows the story, if one does. */
  send: (type: string, ...args: unknown[]) => void;
  /** New globals for the story. */
  setGlobals: (globals: Globals) => void;
  release: () => void;
}

interface Lease extends FrameLeaseRequest {
  frame?: Frame;
  released: boolean;
}

interface Frame {
  iframe: HTMLIFrameElement;
  // The story its preview renders or rendered, with these globals.
  storyId: StoryId;
  globals: string;
  // Whether that render ended: only then may the frame switch.
  ended: boolean;
  onEnded: (() => void)[];
  owner?: Lease;
  // When it was last freed: the longest free is reused first.
  freedAt: number;
}

const globalsKey = (globals: Globals) => JSON.stringify(globals);

/**
 * Whether a story renders in a frame of its own: as docs decide to show it in an iframe, by its
 * layout or `docs.story.inline`.
 */
export const rendersInFrame = (parameters: Parameters) =>
  parameters.layout === 'document' || parameters.docs?.story?.inline === false;

export class FramePool {
  private frames: Frame[] = [];

  private waiting: Lease[] = [];

  private layer?: HTMLElement;

  private pumpScheduled = false;

  private following = false;

  constructor(
    private readonly size: number,
    private readonly max: number
  ) {
    globalThis.addEventListener('message', (event) => this.onMessage(event));
    globalThis.addEventListener('scroll', () => this.schedulePump(), { passive: true });
    globalThis.addEventListener('resize', () => this.schedulePump(), { passive: true });
  }

  lease(request: FrameLeaseRequest): FrameLease {
    const lease: Lease = { ...request, released: false };
    this.waiting.push(lease);
    this.schedulePump();
    return {
      send: (type, ...args) => {
        const { frame } = lease;
        if (frame?.owner === lease && frame.storyId === lease.storyId) {
          this.post(frame, type, ...args);
        }
      },
      setGlobals: (globals) => {
        lease.globals = globals;
        const { frame } = lease;
        if (frame?.owner === lease) {
          this.hide(frame, lease);
          frame.owner = undefined;
          lease.frame = undefined;
          this.waiting.push(lease);
          this.schedulePump();
        }
      },
      release: () => this.release(lease),
    };
  }

  private release(lease: Lease) {
    lease.released = true;
    this.waiting = this.waiting.filter((waiting) => waiting !== lease);
    const { frame } = lease;
    if (frame?.owner === lease) {
      this.free(frame);
    }
    this.schedulePump();
  }

  private free(frame: Frame) {
    frame.owner = undefined;
    frame.freedAt = performance.now();
    this.hide(frame);
  }

  // A hidden frame is fixed off the screen: a play function that focuses a field in it then
  // scrolls nothing, where over its place it would scroll the page to the field.
  private hide(frame: Frame, owner = frame.owner) {
    const { style } = frame.iframe;
    style.visibility = 'hidden';
    style.position = 'fixed';
    style.left = '-10000px';
    style.top = '0px';
    if (owner && !owner.released) {
      owner.onShow?.(false);
    }
  }

  private layerOf() {
    if (!this.layer?.isConnected) {
      this.layer = document.createElement('div');
      this.layer.setAttribute('data-storybook-frame-pool', '');
      this.layer.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;z-index:1';
      document.documentElement.append(this.layer);
    }
    return this.layer;
  }

  private createFrame(lease: Lease): Frame {
    const iframe = document.createElement('iframe');
    iframe.title = lease.storyId;
    iframe.setAttribute('data-storybook-frame', '');
    iframe.style.cssText =
      'position:fixed;top:0;left:-10000px;width:100%;height:100%;border:0;visibility:hidden';
    const params = new URLSearchParams({
      id: lease.storyId,
      viewMode: 'story',
      [FRAME_POOL_PARAM]: 'frame',
    });
    // As the manager writes `globals` in a URL (parseArgsParam.ts reads it): a boolean is `!true`
    // or `!false`, which as `true` and `false` would be strings, and so both truthy.
    // Globals that the URL cannot say, such as an object, follow with UPDATE_GLOBALS.
    const entries = Object.entries(lease.globals).flatMap(([key, value]) => {
      if (typeof value === 'boolean') {
        return [`${key}:!${value}`];
      }
      return typeof value === 'string' && /^[\w -]*$/.test(value) ? [`${key}:${value}`] : [];
    });
    const globals = entries.join(';');
    if (globals) {
      params.set('globals', globals);
    }
    if (!lease.autoplay) {
      params.set('autoplay', 'false');
    }
    iframe.src = `iframe.html?${params}`;
    const frame: Frame = {
      iframe,
      storyId: lease.storyId,
      globals:
        entries.length === Object.keys(lease.globals).length ? globalsKey(lease.globals) : '',
      ended: false,
      onEnded: [],
      freedAt: 0,
    };
    this.watchRender(frame);
    this.layerOf().append(iframe);
    this.frames.push(frame);
    return frame;
  }

  // The frame for `lease`: a free one that shows its story already, the free one whose render ended
  // longest ago, or a new one. The pool grows to `size` for stories near the screen, and beyond it,
  // up to `max`, for each story in view: everything in view shows, however many that is.
  private frameFor(lease: Lease) {
    const free = this.frames.filter((frame) => !frame.owner);
    const showing = free.find(
      (frame) => frame.storyId === lease.storyId && frame.globals === globalsKey(lease.globals)
    );
    if (showing) {
      return showing;
    }
    const reusable = free.filter((frame) => frame.ended).sort((a, b) => a.freedAt - b.freedAt)[0];
    if (reusable) {
      return reusable;
    }
    const inView = [
      ...this.waiting,
      ...this.frames.flatMap(({ owner }) => (owner ? [owner] : [])),
    ].filter((other) => this.distance(other) <= 0).length;
    if (this.frames.length < Math.min(this.max, Math.max(this.size, inView))) {
      return this.createFrame(lease);
    }
    return undefined;
  }

  private async show(frame: Frame, lease: Lease) {
    frame.owner = lease;
    lease.frame = frame;
    await this.ended(frame);
    if (frame.owner !== lease) {
      return;
    }
    // New globals render the story the frame shows again; it switches once that render ended.
    const globals = globalsKey(lease.globals);
    if (frame.globals !== globals) {
      frame.globals = globals;
      this.watchRender(frame);
      this.post(frame, UPDATE_GLOBALS, { globals: lease.globals });
      await this.ended(frame);
      if (frame.owner !== lease) {
        return;
      }
    }
    if (frame.storyId !== lease.storyId) {
      frame.storyId = lease.storyId;
      this.watchRender(frame);
      this.post(frame, SET_CURRENT_STORY, {
        storyId: lease.storyId,
        viewMode: 'story',
        autoplay: lease.autoplay,
      });
      await this.ended(frame);
      if (frame.owner !== lease) {
        return;
      }
    }
    this.place(frame.iframe, lease.place);
    frame.iframe.style.visibility = 'visible';
    frame.iframe.title = lease.storyId;
    this.follow();
    lease.onShow?.(true);
  }

  // Marks the frame's render as running until its preview reports that it ended.
  private watchRender(frame: Frame) {
    frame.ended = false;
    const timeout = setTimeout(() => this.end(frame), RENDER_TIMEOUT);
    frame.onEnded.push(() => clearTimeout(timeout));
  }

  private end(frame: Frame) {
    frame.ended = true;
    const callbacks = frame.onEnded.splice(0);
    callbacks.forEach((callback) => callback());
    this.schedulePump();
  }

  private ended(frame: Frame) {
    return frame.ended
      ? Promise.resolve()
      : new Promise<void>((resolve) => frame.onEnded.push(resolve));
  }

  private onMessage(event: MessageEvent) {
    const frame = this.frames.find(({ iframe }) => iframe.contentWindow === event.source);
    if (!frame || event.origin !== location.origin) {
      return;
    }
    let message: { key?: string; event?: FrameEvent };
    try {
      message =
        typeof event.data === 'string' && isJSON(event.data) ? parse(event.data) : event.data;
    } catch {
      return;
    }
    if (message?.key !== KEY || !message.event) {
      return;
    }
    const { type, args } = message.event;
    if (type === STORY_RENDER_PHASE_CHANGED) {
      const { newPhase, storyId } = (args[0] ?? {}) as { newPhase?: string; storyId?: StoryId };
      if (!frame.ended && storyId === frame.storyId && ENDED_PHASES.includes(newPhase ?? '')) {
        this.end(frame);
      }
    }
    const { owner } = frame;
    if (owner && owner.storyId === frame.storyId) {
      owner.onEvent?.({ type, args });
    }
  }

  private post(frame: Frame, type: string, ...args: unknown[]) {
    const data = stringify(
      { key: KEY, event: { type, args, from: 'frame-pool' }, refId: null },
      { maxDepth: 25 }
    );
    frame.iframe.contentWindow?.postMessage(data, location.origin);
  }

  // How far a lease's place is from the screen, in pixels: 0 in view, and below that for a lease
  // that fills the window.
  private distance(lease: Lease) {
    if (!lease.place) {
      return -1;
    }
    const rect = lease.place.getBoundingClientRect();
    if (rect.bottom < 0) {
      return -rect.bottom;
    }
    if (rect.top > innerHeight) {
      return rect.top - innerHeight;
    }
    return 0;
  }

  // The nearest story without a frame gets one: a free one, or the frame of a story farther away
  // and out of view whose render ended, and which waits again.
  private pump() {
    this.waiting.sort((a, b) => this.distance(a) - this.distance(b));
    while (this.waiting.length > 0) {
      const lease = this.waiting[0]!;
      let frame = this.frameFor(lease);
      if (!frame) {
        const near = Math.max(this.distance(lease), 0);
        frame = this.frames
          .filter(
            (candidate) =>
              candidate.owner && candidate.ended && this.distance(candidate.owner) > near
          )
          .sort((a, b) => this.distance(b.owner!) - this.distance(a.owner!))[0];
        if (!frame) {
          return;
        }
        const evicted = frame.owner!;
        evicted.frame = undefined;
        this.free(frame);
        this.waiting.push(evicted);
      }
      this.waiting.shift();
      void this.show(frame, lease);
    }
  }

  private schedulePump() {
    if (this.pumpScheduled) {
      return;
    }
    this.pumpScheduled = true;
    requestAnimationFrame(() => {
      this.pumpScheduled = false;
      this.pump();
    });
  }

  private place(iframe: HTMLIFrameElement, over: HTMLElement | undefined) {
    const values = over
      ? (() => {
          const rect = over.getBoundingClientRect();
          return {
            position: 'absolute',
            left: `${rect.left + scrollX}px`,
            top: `${rect.top + scrollY}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
          };
        })()
      : { position: 'fixed', left: '0px', top: '0px', width: '100%', height: '100%' };
    for (const [key, value] of Object.entries(values) as [keyof typeof values, string][]) {
      if (iframe.style[key] !== value) {
        iframe.style[key] = value;
      }
    }
  }

  // Keeps each shown frame over its story's place as the page lays out anew. A place that left
  // the page gives its frame back.
  private follow() {
    if (this.following) {
      return;
    }
    this.following = true;
    const frame = () => {
      const shown = this.frames.filter(
        (candidate) => candidate.owner && candidate.iframe.style.visibility === 'visible'
      );
      if (shown.length === 0) {
        this.following = false;
        return;
      }
      for (const { iframe, owner } of shown) {
        if (owner!.place && !owner!.place.isConnected) {
          this.release(owner!);
        } else {
          this.place(iframe, owner!.place);
        }
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}

let pool: FramePool | undefined;

/**
 * The pool of this preview, with `features.experimentalFramePool` on, in a preview that the manager
 * shows. A frame of the pool has none: the stories it renders are its own.
 */
export const getFramePool = (): FramePool | undefined => {
  const feature = globalThis.FEATURES?.experimentalFramePool;
  if (!feature || typeof document === 'undefined' || globalThis.parent === globalThis.self) {
    return undefined;
  }
  if (new URLSearchParams(location.search).has(FRAME_POOL_PARAM)) {
    return undefined;
  }
  const options = typeof feature === 'object' ? feature : {};
  const size = options.size ?? 2;
  // On a phone few stories fit the screen, and little memory the page.
  const max = matchMedia('(max-width: 600px)').matches
    ? (options.mobileMax ?? size)
    : Number.POSITIVE_INFINITY;
  pool ??= new FramePool(Math.min(size, max), max);
  return pool;
};
