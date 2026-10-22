import type { ChannelEvent } from 'storybook/internal/channels';
import {
  CONFIG_ERROR,
  CURRENT_STORY_WAS_SET,
  DOCS_RENDERED,
  GLOBALS_UPDATED,
  SET_CURRENT_STORY,
  SET_GLOBALS,
  STORY_CHANGED,
  STORY_ERRORED,
  STORY_MISSING,
  STORY_RENDER_PHASE_CHANGED,
  STORY_THREW_EXCEPTION,
  STORY_UNCHANGED,
  UPDATE_GLOBALS,
} from 'storybook/internal/core-events';
import type { Globals, StoryId } from 'storybook/internal/types';

import { isJSON, parse, stringify } from 'telejson';

import { KEY } from '../../../channels/postmessage/index.ts';
import {
  FRAME_POOL_LAYOUT,
  FRAME_POOL_SHOWN,
  type FramePoolLayout,
  type FramePoolShown,
  type FramePoolSlot,
  POOL_FRAME_ATTRIBUTE,
  POOL_FRAME_REPLAY_ATTRIBUTE,
} from '../../../shared/constants/frame-pool.ts';
import {
  IFRAME_RESIZE_CONTEXT,
  parseIframeResizeMessage,
} from '../../../shared/constants/iframe-resize.ts';

/** The id of the frame the manager shows, which the manager's code addresses as the preview. */
export const ACTIVE_FRAME_ID = 'storybook-preview-iframe';

// A frame that reports neither an end nor a failure of its render in this time is taken to have
// ended: a preview that hangs must not hold the pool forever.
const BUSY_TIMEOUT = 30_000;
const WARM_DELAY = 1_000;
// A docs page reports that it rendered before its inline stories start to: a frame is idle once it
// reported nothing about a render for this long.
const QUIET = 250;
const MAX_LOG = 2_000;
const ENDED_PHASES = new Set(['finished', 'errored', 'aborted']);
// A preview that tears down a render in these phases reloads itself.
const PENDING_PHASES = new Set(['loading', 'beforeEach', 'rendering', 'playing', 'afterEach']);
const FAILURES = new Set<string>([
  STORY_MISSING,
  STORY_ERRORED,
  STORY_THREW_EXCEPTION,
  CONFIG_ERROR,
]);
const RENDER_EVENTS = new Set<string>([
  CURRENT_STORY_WAS_SET,
  DOCS_RENDERED,
  STORY_RENDER_PHASE_CHANGED,
]);
const HIDDEN = {
  position: 'fixed',
  left: '-10000px',
  top: '0px',
  visibility: 'hidden',
} as const;

export interface FramePoolEntry {
  id: string;
  viewMode: 'story' | 'docs';
}

export interface FramePoolDeps {
  size: number;
  max: number;
  /** The URL of a new frame that boots on `entry`. */
  src: (entry: FramePoolEntry, options: { autoplay: boolean; selected: boolean }) => string;
  userGlobals: () => Globals;
  hasPlay: (storyId: StoryId) => boolean;
  firstStory: () => StoryId | undefined;
  /** Hands an event of the shown frame to the manager's listeners. */
  receive: (event: ChannelEvent) => void;
}

interface ViewLease {
  kind: 'view';
  entry: FramePoolEntry;
  frame?: Frame;
}

interface SlotLease {
  kind: 'slot';
  slot: FramePoolSlot;
  frame?: Frame;
  shown: boolean;
}

type Lease = ViewLease | SlotLease;

interface Frame {
  iframe: HTMLIFrameElement;
  name: string;
  // What its preview shows, or was last told to show.
  entry: FramePoolEntry;
  autoplay: boolean;
  globals: string;
  // What a reload brings back: the URL keeps the parameters the frame was created with.
  boot: { autoplay: boolean; globals: string };
  booting: boolean;
  // Until the event that ends what its preview was last told to do.
  busy?: (event: ChannelEvent) => boolean;
  busyTimer?: ReturnType<typeof setTimeout>;
  // Its renders that may not be torn down, by story and render.
  pending: Set<string>;
  lastRender: number;
  quietTimer?: ReturnType<typeof setTimeout>;
  // Until the preview's CURRENT_STORY_WAS_SET for a boot or a switch, what it reports is not of
  // its entry.
  switching: boolean;
  loads: number;
  // The channel events of its current selection, which the manager hears when it shows the frame.
  log: ChannelEvent[];
  owner?: Lease;
  freedAt: number;
  // What its docs page reports.
  slots: FramePoolSlot[];
  height: number;
  onIdle: (() => void)[];
}

const globalsKey = (globals: Globals = {}) =>
  JSON.stringify(
    Object.keys(globals)
      .sort()
      .map((key) => [key, globals[key]])
  );

const sameEntry = (a: FramePoolEntry, b: FramePoolEntry) =>
  a.id === b.id && a.viewMode === b.viewMode;

const setStyle = (iframe: HTMLIFrameElement, values: Record<string, string>) => {
  for (const [key, value] of Object.entries(values)) {
    if (iframe.style.getPropertyValue(key) !== value) {
      iframe.style.setProperty(key, value);
    }
  }
};

/**
 * The previews of `features.experimentalFramePool`. The manager keeps a few `iframe.html` frames,
 * all equal: the one it shows full size is the preview, and the channel speaks to it alone. A docs
 * page is a frame too, sized to its content in a container the manager scrolls, and the stories
 * it shows in iframes are other frames, laid over its story blocks. A frame switches between
 * stories and docs pages with `SET_CURRENT_STORY`, never gets a new `src`, and is never moved in
 * the document, which would load it again.
 *
 * A frame switches only once its renders ended: a preview that tears down a render that still runs
 * reloads itself. The pool grows by one booting frame at a time, to the stories in view.
 */
export class FramePool {
  private frames: Frame[] = [];

  private host?: HTMLElement;

  private view?: ViewLease;

  private slots: SlotLease[] = [];

  private active?: Frame;

  // The frame shown before, which stays until the next one shows.
  private stale?: Frame;

  private pumpScheduled = false;

  private replayTimer?: ReturnType<typeof setTimeout>;

  private warm = false;

  private nextName = 0;

  private readonly resizeObserver?: ResizeObserver;

  constructor(private readonly deps: FramePoolDeps) {
    globalThis.addEventListener('message', this.onMessage);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.schedulePump());
    }
  }

  /** The element the frames lie in, which scrolls a docs page. */
  attach(host: HTMLElement) {
    if (this.host === host) {
      return;
    }
    this.host = host;
    host.addEventListener('scroll', () => this.schedulePump(), { passive: true });
    this.resizeObserver?.observe(host);
    host.append(...this.frames.map(({ iframe }) => iframe));
    this.pump();
  }

  /** Shows `entry`, a story or a docs page, or no frame when there is none. */
  select(entry?: FramePoolEntry) {
    const { view, active } = this;
    if (view && entry && sameEntry(view.entry, entry)) {
      return;
    }
    // The shown frame got there by itself: the manager follows a preview that selected the story.
    if (view && entry && active && view.frame === active && sameEntry(active.entry, entry)) {
      view.entry = entry;
      return;
    }
    this.leave();
    this.view = entry ? { kind: 'view', entry } : undefined;
    this.pump();
  }

  private leave() {
    const { view } = this;
    if (!view) {
      return;
    }
    this.dropSlots();
    this.view = undefined;
    if (view.frame) {
      this.free(view.frame);
    }
    if (this.active) {
      this.stale = this.active;
      this.deactivate();
    }
  }

  private free(frame: Frame) {
    if (frame.owner) {
      frame.owner.frame = undefined;
    }
    frame.owner = undefined;
    frame.freedAt = performance.now();
  }

  private activate(frame: Frame, { switched }: { switched: boolean }) {
    if (this.active === frame) {
      return;
    }
    this.deactivate();
    this.active = frame;
    this.stale = undefined;
    frame.iframe.id = ACTIVE_FRAME_ID;
    frame.iframe.setAttribute('data-is-storybook', 'true');
    if (this.host) {
      this.host.scrollTop = 0;
    }
    if (!switched && frame.log.length > 0) {
      // The manager hears what the frame reported while it was not shown, as if it had been, once
      // it rendered the new view: the panels of a story view only listen from then on. Until then
      // the frame's events go to its log.
      frame.iframe.setAttribute(POOL_FRAME_REPLAY_ATTRIBUTE, '');
      this.replayTimer = setTimeout(() => this.replay(frame));
    }
    if (this.isDocsView(frame)) {
      this.syncSlots();
    }
    this.layout();
  }

  private replay(frame: Frame) {
    frame.iframe.removeAttribute(POOL_FRAME_REPLAY_ATTRIBUTE);
    const log = frame.log.slice();
    if (frame.entry.viewMode === 'story' && !log.some(isStoryChanged)) {
      this.deps.receive(
        this.tag(frame, { type: STORY_CHANGED, args: [frame.entry.id], from: 'frame-pool' })
      );
    }
    log.forEach((event) => this.deps.receive(event));
  }

  private deactivate() {
    const { active } = this;
    if (!active) {
      return;
    }
    clearTimeout(this.replayTimer);
    active.iframe.removeAttribute(POOL_FRAME_REPLAY_ATTRIBUTE);
    this.active = undefined;
    active.iframe.id = active.name;
    active.iframe.setAttribute('data-is-storybook', 'false');
  }

  private isDocsView(frame: Frame) {
    return (
      frame === this.active &&
      this.view?.frame === frame &&
      frame.entry.viewMode === 'docs' &&
      !frame.switching
    );
  }

  // The slots of the shown docs page follow what it reported last.
  private syncSlots() {
    const docs = this.view?.frame;
    if (!docs || !this.isDocsView(docs)) {
      return;
    }
    const reported = new Map(docs.slots.map((slot) => [slot.id, slot]));
    this.slots = this.slots.filter((lease) => {
      const slot = reported.get(lease.slot.id);
      const same =
        slot &&
        slot.storyId === lease.slot.storyId &&
        slot.autoplay === lease.slot.autoplay &&
        globalsKey(slot.globals) === globalsKey(lease.slot.globals);
      if (same) {
        lease.slot = slot;
        reported.delete(slot.id);
        return true;
      }
      this.releaseSlot(lease);
      return false;
    });
    for (const slot of reported.values()) {
      this.slots.push({ kind: 'slot', slot, shown: false });
    }
    this.schedulePump();
  }

  private dropSlots() {
    this.slots.forEach((lease) => this.releaseSlot(lease));
    this.slots = [];
  }

  private releaseSlot(lease: SlotLease) {
    if (lease.frame) {
      this.free(lease.frame);
    }
    this.setShown(lease, false);
  }

  private setShown(lease: SlotLease, shown: boolean) {
    if (lease.shown === shown) {
      return;
    }
    lease.shown = shown;
    const docs = this.view?.frame;
    if (docs) {
      this.post(docs, FRAME_POOL_SHOWN, { id: lease.slot.id, shown } satisfies FramePoolShown);
    }
  }

  private leases(): Lease[] {
    return [...(this.view ? [this.view] : []), ...this.slots];
  }

  // How far a lease is from the screen, in pixels: 0 in view, and below that for the view.
  private distance(lease: Lease) {
    if (lease.kind === 'view' || !this.host) {
      return -1;
    }
    const { scrollTop, clientHeight } = this.host;
    const top = lease.slot.rect.top - scrollTop;
    const bottom = top + lease.slot.rect.height;
    if (bottom < 0) {
      return -bottom;
    }
    return top > clientHeight ? top - clientHeight : 0;
  }

  private capacity() {
    const inView = this.leases().filter((lease) => this.distance(lease) <= 0).length;
    return Math.min(this.deps.max, Math.max(this.deps.size, inView));
  }

  private leaseEntry(lease: Lease): FramePoolEntry {
    return lease.kind === 'view' ? lease.entry : { id: lease.slot.storyId, viewMode: 'story' };
  }

  private leaseGlobals(lease: Lease) {
    return lease.kind === 'view' ? this.deps.userGlobals() : lease.slot.globals;
  }

  private leaseAutoplay(lease: Lease) {
    return lease.kind === 'view' || lease.slot.autoplay;
  }

  // Whether the frame shows what the lease wants: a story that has to play has played.
  private shows(frame: Frame, lease: Lease) {
    const entry = this.leaseEntry(lease);
    return (
      (entry.id === '*' || sameEntry(frame.entry, entry)) &&
      frame.globals === globalsKey(this.leaseGlobals(lease)) &&
      !this.lacksPlay(frame, lease)
    );
  }

  // The frame shows the story without its play, which selecting it again does not run.
  private lacksPlay(frame: Frame, lease: Lease) {
    const entry = this.leaseEntry(lease);
    return (
      sameEntry(frame.entry, entry) &&
      entry.viewMode === 'story' &&
      this.leaseAutoplay(lease) &&
      !frame.autoplay &&
      this.deps.hasPlay(entry.id)
    );
  }

  private idle(frame: Frame) {
    return !frame.busy && frame.pending.size === 0 && performance.now() - frame.lastRender >= QUIET;
  }

  private booting() {
    return this.frames.some((frame) => frame.booting);
  }

  // A free frame that shows the lease's entry, the free one that ended longest ago, or a new one.
  private frameFor(lease: Lease) {
    const free = this.frames.filter((frame) => !frame.owner);
    const showing = free.find((frame) => this.shows(frame, lease));
    if (showing) {
      return showing;
    }
    const reusable = free
      .filter((frame) => this.idle(frame) && !this.lacksPlay(frame, lease))
      .sort((a, b) => a.freedAt - b.freedAt)[0];
    if (reusable) {
      return reusable;
    }
    if (this.frames.length < this.capacity() && !this.booting()) {
      return this.create(this.leaseEntry(lease), lease);
    }
    return undefined;
  }

  private pump() {
    if (!this.host) {
      return;
    }
    const waiting = this.leases()
      .filter((lease) => !lease.frame)
      .sort((a, b) => this.distance(a) - this.distance(b));
    for (const lease of waiting) {
      let frame = this.frameFor(lease);
      if (!frame) {
        // The frame of a story farther from the screen, which waits again.
        const near = Math.max(this.distance(lease), 0);
        frame = this.frames
          .filter(
            (candidate) =>
              candidate.owner?.kind === 'slot' &&
              this.idle(candidate) &&
              this.distance(candidate.owner) > near
          )
          .sort((a, b) => this.distance(b.owner!) - this.distance(a.owner!))[0];
        if (!frame) {
          break;
        }
        const evicted = frame.owner as SlotLease;
        this.free(frame);
        this.setShown(evicted, false);
      }
      frame.owner = lease;
      lease.frame = frame;
      void this.show(frame, lease);
    }
    this.warmUp();
    this.layout();
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

  // Boots frames ahead of the stories that will need them, up to `size`, once the first frame
  // rendered: a story then only switches a frame, instead of waiting for one to boot.
  private warmUp() {
    const storyId = this.deps.firstStory();
    if (this.warm && storyId && this.frames.length < this.deps.size && !this.booting()) {
      this.create({ id: storyId, viewMode: 'story' });
    }
  }

  private async show(frame: Frame, lease: Lease) {
    if (lease.kind === 'view' && this.shows(frame, lease)) {
      this.activate(frame, { switched: false });
      return;
    }
    await this.whenIdle(frame);
    if (frame.owner !== lease) {
      return;
    }
    const entry = this.leaseEntry(lease);
    const globals = this.leaseGlobals(lease);
    const autoplay = this.leaseAutoplay(lease);
    const switched = !sameEntry(frame.entry, entry);
    if (switched) {
      Object.assign(frame, {
        entry,
        autoplay,
        globals: globalsKey(globals),
        switching: true,
        log: [],
        slots: [],
        height: 0,
      });
      this.post(frame, SET_CURRENT_STORY, {
        storyId: entry.id,
        viewMode: entry.viewMode,
        autoplay,
        globals,
      });
      this.expect(frame, rendered(entry));
    } else if (frame.globals !== globalsKey(globals)) {
      frame.globals = globalsKey(globals);
      this.post(frame, UPDATE_GLOBALS, { globals });
      this.expect(
        frame,
        entry.viewMode === 'docs' ? (event) => event.type === GLOBALS_UPDATED : rendered(entry)
      );
    }
    if (lease.kind === 'view') {
      this.activate(frame, { switched });
      return;
    }
    await this.whenIdle(frame);
    if (frame.owner !== lease) {
      return;
    }
    this.setShown(lease, true);
    this.layout();
  }

  private create(entry: FramePoolEntry, lease?: Lease): Frame {
    const iframe = document.createElement('iframe');
    const name = `storybook-pool-frame-${(this.nextName += 1)}`;
    const autoplay = lease ? this.leaseAutoplay(lease) : false;
    const globals = globalsKey(this.deps.userGlobals());
    iframe.id = name;
    iframe.title = 'storybook-preview';
    iframe.setAttribute(POOL_FRAME_ATTRIBUTE, '');
    iframe.setAttribute('data-is-storybook', 'false');
    iframe.setAttribute('allow', 'clipboard-write;');
    iframe.allowFullscreen = true;
    iframe.style.cssText = 'border:0;display:block;width:100%;height:100%';
    setStyle(iframe, HIDDEN);
    iframe.src = this.deps.src(entry, { autoplay, selected: lease?.kind === 'view' });
    const frame: Frame = {
      iframe,
      name,
      entry,
      autoplay,
      globals,
      boot: { autoplay, globals },
      booting: true,
      pending: new Set(),
      lastRender: 0,
      switching: true,
      loads: 0,
      log: [],
      freedAt: 0,
      slots: [],
      height: 0,
      onIdle: [],
    };
    this.expect(frame, rendered(entry));
    iframe.addEventListener('load', () => this.onLoad(frame));
    this.frames.push(frame);
    this.host?.append(iframe);
    return frame;
  }

  // A frame that loads again reloaded itself, and boots: it renders what it showed last.
  private onLoad(frame: Frame) {
    frame.loads += 1;
    frame.iframe.setAttribute('data-is-loaded', 'true');
    if (frame.loads === 1) {
      return;
    }
    Object.assign(frame, {
      booting: true,
      switching: true,
      autoplay: frame.boot.autoplay,
      globals: frame.boot.globals,
      log: [],
      slots: [],
      height: 0,
    });
    frame.pending.clear();
    this.expect(frame, rendered(frame.entry));
  }

  private expect(frame: Frame, until: (event: ChannelEvent) => boolean) {
    clearTimeout(frame.busyTimer);
    frame.busy = until;
    frame.busyTimer = setTimeout(() => {
      frame.pending.clear();
      this.settle(frame);
    }, BUSY_TIMEOUT);
  }

  private settle(frame: Frame) {
    clearTimeout(frame.busyTimer);
    frame.busy = undefined;
    if (frame.booting) {
      frame.booting = false;
      if (!this.warm) {
        setTimeout(() => {
          this.warm = true;
          this.schedulePump();
        }, WARM_DELAY);
      }
    }
    this.checkIdle(frame);
    this.schedulePump();
  }

  private checkIdle(frame: Frame) {
    if (this.idle(frame)) {
      frame.onIdle.splice(0).forEach((resolve) => resolve());
    }
  }

  private whenIdle(frame: Frame) {
    return this.idle(frame)
      ? Promise.resolve()
      : new Promise<void>((resolve) => frame.onIdle.push(resolve));
  }

  private onMessage = (event: MessageEvent) => {
    const frame = this.frames.find(({ iframe }) => iframe.contentWindow === event.source);
    if (!frame || event.origin !== location.origin) {
      return;
    }
    let data: { key?: string; event?: ChannelEvent; context?: string };
    try {
      data = typeof event.data === 'string' && isJSON(event.data) ? parse(event.data) : event.data;
    } catch {
      return;
    }
    if (data?.context === IFRAME_RESIZE_CONTEXT) {
      const size = parseIframeResizeMessage(data);
      if (size && size.height !== frame.height) {
        frame.height = size.height;
        this.layout();
      }
      return;
    }
    if (data?.key === KEY && data.event) {
      this.onFrameEvent(frame, data.event);
    }
  };

  private onFrameEvent(frame: Frame, event: ChannelEvent) {
    const { type, args = [] } = event;
    const payload = args[0];
    if (type === FRAME_POOL_LAYOUT) {
      if (!frame.switching) {
        frame.slots = (payload as FramePoolLayout).slots ?? [];
        this.syncSlots();
      }
      return;
    }
    if (type === CURRENT_STORY_WAS_SET) {
      const { storyId, viewMode } = payload as { storyId: StoryId; viewMode?: string };
      frame.entry = { id: storyId, viewMode: viewMode === 'docs' ? 'docs' : 'story' };
      frame.switching = false;
      frame.log = [];
      if (frame === this.active) {
        this.syncSlots();
        this.layout();
      }
    } else if (type === SET_GLOBALS) {
      frame.globals = globalsKey((payload as { globals: Globals }).globals);
    } else if (type === GLOBALS_UPDATED) {
      frame.globals = globalsKey((payload as { userGlobals: Globals }).userGlobals);
    } else if (type === STORY_RENDER_PHASE_CHANGED) {
      const { storyId, renderId, newPhase } = payload as Record<string, string>;
      const render = `${storyId}:${renderId}`;
      if (PENDING_PHASES.has(newPhase)) {
        frame.pending.add(render);
      } else {
        frame.pending.delete(render);
      }
    }
    if (RENDER_EVENTS.has(type)) {
      frame.lastRender = performance.now();
      clearTimeout(frame.quietTimer);
      frame.quietTimer = setTimeout(() => {
        this.checkIdle(frame);
        this.schedulePump();
      }, QUIET);
    }
    if (!frame.switching) {
      frame.log.push(this.tag(frame, event));
      if (frame.log.length > MAX_LOG) {
        frame.log.shift();
      }
    }
    if (frame.busy?.(event)) {
      this.settle(frame);
    } else {
      this.checkIdle(frame);
    }
  }

  // An event as the channel's transport hands it to the manager's listeners.
  private tag(frame: Frame, event: ChannelEvent): ChannelEvent {
    const { protocol, host, pathname } = new URL(frame.iframe.src, location.href);
    return { ...event, source: `${protocol}//${host}${pathname}` } as ChannelEvent;
  }

  private post(frame: Frame, type: string, ...args: unknown[]) {
    const data = stringify(
      { key: KEY, event: { type, args, from: 'frame-pool' }, refId: null },
      { maxDepth: 25 }
    );
    frame.iframe.contentWindow?.postMessage(data, location.origin);
  }

  // Lays each frame out by its role: the shown one fills the host, or is the docs page the host
  // scrolls; a story of that page lies over its block; the rest lies off the screen.
  private layout() {
    const { host, active } = this;
    if (!host) {
      return;
    }
    const docs = !!active && this.isDocsView(active);
    if (active) {
      host.style.overflowY = docs ? 'auto' : 'hidden';
    }
    for (const frame of this.frames) {
      const { owner } = frame;
      if (frame === active) {
        setStyle(frame.iframe, {
          position: 'absolute',
          left: '0px',
          top: '0px',
          width: '100%',
          height: docs && frame.height ? `${frame.height}px` : '100%',
          visibility: 'visible',
        });
      } else if (docs && owner?.kind === 'slot' && owner.shown) {
        const { top, left, width, height } = owner.slot.rect;
        setStyle(frame.iframe, {
          position: 'absolute',
          left: `${left}px`,
          top: `${top}px`,
          width: `${width}px`,
          height: `${height}px`,
          visibility: 'visible',
        });
      } else if (!(frame === this.stale && !active)) {
        setStyle(frame.iframe, HIDDEN);
      }
    }
  }
}

const isStoryChanged = ({ type }: ChannelEvent) => type === STORY_CHANGED;

// The event that ends the render of `entry` in a preview: '*' is whatever the preview picks.
const rendered =
  (entry: FramePoolEntry) =>
  ({ type, args = [] }: ChannelEvent) => {
    if (FAILURES.has(type) || type === STORY_UNCHANGED) {
      return true;
    }
    const matches = (id: unknown) => entry.id === '*' || id === entry.id;
    if (type === DOCS_RENDERED) {
      return entry.viewMode === 'docs' && matches(args[0]);
    }
    if (type === STORY_RENDER_PHASE_CHANGED) {
      const { storyId, newPhase } = (args[0] ?? {}) as Record<string, string>;
      return (
        (entry.viewMode === 'story' || entry.id === '*') &&
        matches(storyId) &&
        ENDED_PHASES.has(newPhase)
      );
    }
    return false;
  };
