import type { ChannelEvent } from 'storybook/internal/channels';
import {
  CONFIG_ERROR,
  CURRENT_STORY_WAS_SET,
  DOCS_PREPARED,
  DOCS_RENDERED,
  GLOBALS_UPDATED,
  SET_CURRENT_STORY,
  SET_GLOBALS,
  STORY_ARGS_UPDATED,
  STORY_CHANGED,
  STORY_ERRORED,
  STORY_MISSING,
  STORY_PREPARED,
  STORY_RENDER_PHASE_CHANGED,
  STORY_THREW_EXCEPTION,
  STORY_UNCHANGED,
  UPDATE_GLOBALS,
  UPDATE_STORY_ARGS,
} from 'storybook/internal/core-events';
import type { Args, Globals, StoryId } from 'storybook/internal/types';

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
import { SERVICE_SYNC_REQUEST } from '../../../shared/open-service/service-channel.ts';

/** The id of the frame the manager shows, which the manager's code addresses as the preview. */
export const ACTIVE_FRAME_ID = 'storybook-preview-iframe';

// A frame that reports no end of what it was told in this time no longer holds a story waiting for
// it. Its renders still count as running: a frame never switches while one does.
const BUSY_TIMEOUT = 30_000;
const WARM_DELAY = 1_000;
// A docs page reports that it rendered before its inline stories start to: a frame is idle once it
// reported nothing about a render for this long.
const QUIET = 250;
// A free frame still busy this long after it was freed makes room for what is needed now: it may
// never end. The page shown waits no longer than for a frame that just ended to go quiet.
const STUCK_AFTER = { view: 300, slot: 1_000 };
const MAX_LOG = 2_000;
// The events of a selection that its log keeps when it is full.
const LIFECYCLE_EVENTS = new Set<string>([
  CURRENT_STORY_WAS_SET,
  STORY_PREPARED,
  DOCS_PREPARED,
  STORY_CHANGED,
]);
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
  // While it is shown but the manager does not hear it yet: until its preview set the story it
  // switches to, or until the manager heard its log, with the story changed or not.
  hold?: { announce: boolean };
  // Events of the preview itself rather than of a selection, which the manager missed while the
  // frame was not shown: its globals and its open-service sync requests.
  unheard: Map<string, ChannelEvent>;
  // The args of the stories its preview prepared.
  args: Map<StoryId, Args>;
  owner?: Lease;
  freedAt: number;
  // When it was last in view, or shown.
  seenAt: number;
  // What its docs page reports, once it rendered, and where the reader left it.
  docsRendered: boolean;
  slots: FramePoolSlot[];
  height: number;
  scrollTop: number;
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

const sameArgs = (a: Args, b: Args) =>
  JSON.stringify(a, Object.keys(a).sort()) === JSON.stringify(b, Object.keys(b).sort());

const setStyle = (element: HTMLElement, values: Record<string, string>) => {
  for (const [key, value] of Object.entries(values)) {
    if (element.style.getPropertyValue(key) !== value) {
      element.style.setProperty(key, value);
    }
  }
};

/**
 * The previews of `features.experimentalFramePool`. The manager keeps a few `iframe.html` frames,
 * all equal: the one it shows full size is the preview, and the channel speaks to it alone. A docs
 * page is a frame too, sized to its content in a host element the manager scrolls, and the stories
 * it shows in iframes are other frames, laid over its story blocks. A frame switches between
 * stories and docs pages with `SET_CURRENT_STORY`, never gets a new `src`, and is never moved in
 * the document, which would load it again: the pool owns the host they lie in.
 *
 * A frame switches only once its renders ended: a preview that tears down a render that still runs
 * reloads itself. A story keeps its frame as long as the pool has room: it grows by one booting
 * frame at a time, nearest first, up to `max`, and at `max` takes the frame seen least recently.
 */
export class FramePool {
  /** The element the frames lie in, which scrolls a docs page. */
  readonly host: HTMLElement;

  private frames: Frame[] = [];

  private view?: ViewLease;

  private slots: SlotLease[] = [];

  private active?: Frame;

  // The frame shown before, which stays until the next one shows.
  private stale?: Frame;

  private pumpScheduled = false;

  private releaseTimer?: ReturnType<typeof setTimeout>;

  private stuckTimer?: ReturnType<typeof setTimeout>;

  private warm = false;

  private nextName = 0;

  // Whether the manager heard a preview's SET_GLOBALS, with the global types.
  private globalsHeard = false;

  // The args the manager last heard for each story, which a frame that shows the story gets.
  private storyArgs = new Map<StoryId, Args>();

  constructor(private readonly deps: FramePoolDeps) {
    this.host = document.createElement('div');
    this.host.setAttribute('data-storybook-frame-pool', '');
    this.host.style.cssText =
      'position:absolute;inset:0;overflow-x:hidden;overflow-y:hidden;overscroll-behavior:contain';
    this.host.addEventListener('scroll', () => this.schedulePump(), { passive: true });
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => this.schedulePump()).observe(this.host);
    }
    globalThis.addEventListener('message', this.onMessage);
  }

  /**
   * Puts the host in `container`. The host and its frames are never moved after that: the manager
   * keeps the container while it shows other pages. A container that goes all the same takes the
   * frames along, and they boot again in the next.
   */
  attach(container: HTMLElement) {
    if (this.host.parentElement !== container) {
      container.append(this.host);
    }
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

  // Whether the channel's transport hands the frame's events to the manager.
  private heard(frame: Frame) {
    return frame === this.active && !frame.hold;
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
    if (frame.switching ? !frame.booting : frame.log.length > 0) {
      // A frame told to switch still reports the story it showed until its preview set the next
      // one. What a frame reported while it was not shown, the manager hears as if it had been,
      // once it rendered the new view: the panels of a story view only listen from then on.
      frame.hold = { announce: !frame.switching };
      frame.iframe.setAttribute(POOL_FRAME_REPLAY_ATTRIBUTE, '');
      if (!frame.switching) {
        this.scheduleRelease(frame);
      }
    }
    this.hearUnheard(frame);
    this.syncArgs(frame);
    if (this.isDocsView(frame)) {
      this.syncSlots();
    }
    this.layout();
    // The reader finds a docs page where they left it, if the frame still shows it.
    this.host.scrollTop =
      !switched && frame.entry.viewMode === 'docs' && !frame.switching ? frame.scrollTop : 0;
  }

  private scheduleRelease(frame: Frame) {
    clearTimeout(this.releaseTimer);
    this.releaseTimer = setTimeout(() => this.release(frame));
  }

  // The manager hears the frame's log, and from then on the frame itself.
  private release(frame: Frame) {
    const { hold } = frame;
    if (frame !== this.active || !hold) {
      return;
    }
    frame.hold = undefined;
    frame.iframe.removeAttribute(POOL_FRAME_REPLAY_ATTRIBUTE);
    const log = frame.log.slice();
    if (hold.announce && frame.entry.viewMode === 'story' && !log.some(isStoryChanged)) {
      this.deps.receive(
        this.tag(frame, { type: STORY_CHANGED, args: [frame.entry.id], from: 'frame-pool' })
      );
    }
    log.forEach((event) => this.deps.receive(event));
  }

  // The manager hears the global types if no preview told it yet, and answers the frame's sync
  // requests, which bring the services of its preview up to date.
  private hearUnheard(frame: Frame) {
    for (const [key, event] of frame.unheard) {
      if (event.type === SET_GLOBALS && this.globalsHeard) {
        continue;
      }
      if (event.type === SET_GLOBALS) {
        this.globalsHeard = true;
      }
      frame.unheard.delete(key);
      this.deps.receive(event);
    }
  }

  // A story shows with the args the manager last heard for it, also in a frame that never had them.
  private syncArgs(frame: Frame) {
    const storyId = frame.entry.viewMode === 'story' ? frame.entry.id : undefined;
    const wanted = storyId && this.storyArgs.get(storyId);
    const current = storyId && frame.args.get(storyId);
    if (
      !storyId ||
      !wanted ||
      !current ||
      this.view?.frame !== frame ||
      sameArgs(wanted, current)
    ) {
      return;
    }
    const updatedArgs: Args = { ...wanted };
    for (const key of Object.keys(current)) {
      if (!(key in wanted)) {
        updatedArgs[key] = undefined;
      }
    }
    frame.args.set(storyId, wanted);
    this.post(frame, UPDATE_STORY_ARGS, { storyId, updatedArgs });
  }

  private deactivate() {
    const { active } = this;
    if (!active) {
      return;
    }
    clearTimeout(this.releaseTimer);
    active.hold = undefined;
    active.iframe.removeAttribute(POOL_FRAME_REPLAY_ATTRIBUTE);
    if (active.entry.viewMode === 'docs' && !active.switching) {
      active.scrollTop = this.host.scrollTop;
    }
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

  // The slots of the shown docs page follow what it reported last. A block that takes no room, as
  // in a collapsed section, needs no frame.
  private syncSlots() {
    const docs = this.view?.frame;
    if (!docs || !this.isDocsView(docs)) {
      return;
    }
    const reported = new Map(
      docs.slots
        .filter(({ rect }) => rect.width > 0 && rect.height > 0)
        .map((slot) => [slot.id, slot])
    );
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
    if (lease.kind === 'view') {
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

  // The frames of stories out of view, the least recently seen first.
  private away() {
    return this.frames
      .filter((frame) => frame.owner?.kind === 'slot' && this.distance(frame.owner) > 0)
      .sort(bySeen);
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

  // Whether the frame is still doing what it was last told, rather than only going quiet.
  private running(frame: Frame) {
    return !!frame.busy || frame.pending.size > 0;
  }

  private idle(frame: Frame) {
    return !frame.busy && frame.pending.size === 0 && performance.now() - frame.lastRender >= QUIET;
  }

  private booting() {
    return this.frames.some((frame) => frame.booting);
  }

  // A free frame that shows the lease's entry, the free one seen least recently, or a new one up
  // to `max`: a story keeps its frame as long as the pool has room. Frames boot one at a time, but
  // neither the page shown nor a story in view waits for frames that boot for what is out of view.
  private frameFor(lease: Lease) {
    const free = this.frames.filter((frame) => !frame.owner);
    const showing = free.find((frame) => this.shows(frame, lease));
    if (showing) {
      return showing;
    }
    const reusable = free
      .filter((frame) => this.idle(frame) && !this.lacksPlay(frame, lease))
      .sort(bySeen)[0];
    if (reusable) {
      return reusable;
    }
    const inView = lease.kind === 'view' || this.distance(lease) <= 0;
    const booting = this.frames.some(
      (frame) => frame.booting && (!inView || (frame.owner && this.distance(frame.owner) <= 0))
    );
    return this.frames.length < this.deps.max && (lease.kind === 'view' || !booting)
      ? this.create(this.leaseEntry(lease), lease)
      : undefined;
  }

  // At `max`, the frame of a story out of view, farther than the lease, that was seen least
  // recently: it waits again. Never the page shown, nor a story in view.
  private evictFor(lease: Lease) {
    if (this.frames.length < this.deps.max) {
      return undefined;
    }
    const near = Math.max(this.distance(lease), 0);
    const frame = this.away().find(
      (candidate) => this.idle(candidate) && this.distance(candidate.owner!) > near
    );
    if (frame) {
      const evicted = frame.owner as SlotLease;
      this.free(frame);
      this.setShown(evicted, false);
    }
    return frame;
  }

  // At `max`, when no frame can show the lease soon, one goes for a new one: a free frame still
  // busy a while after it was freed, as a docs page no longer shown whose render never ends, or one
  // that shows the story without its play, the one seen least recently first and the one still on
  // the screen last. A story in view takes, as a last resort, the frame of a story out of view that
  // still renders.
  private replaceFor(lease: Lease) {
    if (this.frames.length < this.deps.max) {
      return undefined;
    }
    const now = performance.now();
    const patience = STUCK_AFTER[lease.kind];
    const free = this.frames.filter((frame) => !frame.owner);
    const inView = lease.kind === 'slot' && this.distance(lease) <= 0;
    const [frame = inView ? this.away().find((candidate) => this.running(candidate)) : undefined] =
      free
        .filter(
          (candidate) =>
            this.lacksPlay(candidate, lease) ||
            (this.running(candidate) && now - candidate.freedAt >= patience)
        )
        .sort((a, b) => Number(a === this.stale) - Number(b === this.stale) || bySeen(a, b));
    const waits = free
      .filter((candidate) => this.running(candidate) && now - candidate.freedAt < patience)
      .map((candidate) => candidate.freedAt + patience - now);
    if (!frame && waits.length > 0) {
      clearTimeout(this.stuckTimer);
      this.stuckTimer = setTimeout(() => this.schedulePump(), Math.min(...waits));
    }
    if (
      !frame ||
      (lease.kind === 'slot' &&
        this.frames.some(
          (other) =>
            other !== frame &&
            other.booting &&
            (!inView || (other.owner && this.distance(other.owner) <= 0))
        ))
    ) {
      return undefined;
    }
    if (frame.owner?.kind === 'slot') {
      const evicted = frame.owner;
      this.free(frame);
      this.setShown(evicted, false);
    }
    this.remove(frame);
    return this.create(this.leaseEntry(lease), lease);
  }

  private pump() {
    if (!this.host.isConnected) {
      return;
    }
    const waiting = this.leases()
      .filter((lease) => !lease.frame)
      .sort((a, b) => this.distance(a) - this.distance(b));
    for (const lease of waiting) {
      const frame = this.frameFor(lease) ?? this.evictFor(lease) ?? this.replaceFor(lease);
      if (!frame) {
        break;
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

  private remove(frame: Frame) {
    if (frame === this.stale) {
      this.stale = undefined;
    }
    clearTimeout(frame.busyTimer);
    clearTimeout(frame.quietTimer);
    this.frames = this.frames.filter((candidate) => candidate !== frame);
    frame.iframe.remove();
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
        docsRendered: false,
        slots: [],
        height: 0,
        scrollTop: 0,
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
      unheard: new Map(),
      args: new Map(),
      freedAt: performance.now(),
      seenAt: 0,
      docsRendered: false,
      slots: [],
      height: 0,
      scrollTop: 0,
      onIdle: [],
    };
    this.expect(frame, rendered(entry));
    iframe.addEventListener('load', () => this.onLoad(frame));
    this.frames.push(frame);
    this.host.append(iframe);
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
      docsRendered: false,
      slots: [],
      height: 0,
      scrollTop: 0,
    });
    frame.args.clear();
    frame.pending.clear();
    this.expect(frame, rendered(frame.entry));
  }

  private expect(frame: Frame, until: (event: ChannelEvent) => boolean) {
    clearTimeout(frame.busyTimer);
    frame.busy = until;
    frame.busyTimer = setTimeout(() => this.settle(frame), BUSY_TIMEOUT);
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
    // Until a docs page rendered, the blocks it reports may be those of the page it showed before.
    if (type === FRAME_POOL_LAYOUT) {
      if (!frame.switching && frame.docsRendered) {
        frame.slots = (payload as FramePoolLayout).slots ?? [];
        this.syncSlots();
      }
      return;
    }
    if (type === SET_GLOBALS || type === SERVICE_SYNC_REQUEST) {
      const key = `${type}:${(payload as { serviceId?: string })?.serviceId ?? ''}`;
      if (this.heard(frame)) {
        frame.unheard.delete(key);
        this.globalsHeard ||= type === SET_GLOBALS;
      } else {
        frame.unheard.set(key, this.tag(frame, event));
      }
    }
    if (type === CURRENT_STORY_WAS_SET) {
      const { storyId, viewMode } = payload as { storyId: StoryId; viewMode?: string };
      frame.entry = { id: storyId, viewMode: viewMode === 'docs' ? 'docs' : 'story' };
      frame.switching = false;
      frame.docsRendered = false;
      frame.log = [];
      if (frame === this.active) {
        if (frame.hold) {
          this.scheduleRelease(frame);
        }
        this.syncSlots();
        this.layout();
      }
    } else if (type === DOCS_RENDERED) {
      frame.docsRendered ||= payload === frame.entry.id;
    } else if (type === SET_GLOBALS) {
      frame.globals = globalsKey((payload as { globals: Globals }).globals);
    } else if (type === GLOBALS_UPDATED) {
      frame.globals = globalsKey((payload as { userGlobals: Globals }).userGlobals);
    } else if (type === STORY_PREPARED) {
      const { id, args: storyArgs } = payload as { id: StoryId; args: Args };
      frame.args.set(id, storyArgs);
      if (frame === this.active) {
        this.syncArgs(frame);
      }
    } else if (type === STORY_ARGS_UPDATED) {
      const { storyId, args: storyArgs } = payload as { storyId: StoryId; args: Args };
      frame.args.set(storyId, storyArgs);
      if (frame === this.active) {
        this.storyArgs.set(storyId, storyArgs);
      }
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
      this.append(frame, this.tag(frame, event));
    }
    if (frame.busy?.(event)) {
      this.settle(frame);
    } else {
      this.checkIdle(frame);
    }
  }

  // A full log drops its oldest event that is not of the selection's lifecycle.
  private append(frame: Frame, event: ChannelEvent) {
    const { log } = frame;
    log.push(event);
    if (log.length > MAX_LOG) {
      const oldest = log.findIndex(({ type }) => !LIFECYCLE_EVENTS.has(type));
      log.splice(oldest === -1 ? 0 : oldest, 1);
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
    const now = performance.now();
    const docs = !!active && this.isDocsView(active);
    if (active) {
      host.style.overflowY = docs ? 'auto' : 'hidden';
    }
    for (const frame of this.frames) {
      const { owner } = frame;
      if (frame === active) {
        frame.seenAt = now;
        setStyle(frame.iframe, {
          position: 'absolute',
          left: '0px',
          top: '0px',
          width: '100%',
          height: docs && frame.height ? `${frame.height}px` : '100%',
          visibility: 'visible',
          'z-index': '0',
        });
      } else if (docs && owner?.kind === 'slot' && owner.shown) {
        const { top, left, width, height } = owner.slot.rect;
        if (this.distance(owner) <= 0) {
          frame.seenAt = now;
        }
        setStyle(frame.iframe, {
          position: 'absolute',
          left: `${left}px`,
          top: `${top}px`,
          width: `${width}px`,
          height: `${height}px`,
          visibility: 'visible',
          // Over the docs page, whatever their order in the host, which never changes.
          'z-index': '1',
        });
      } else if (!(frame === this.stale && !active)) {
        setStyle(frame.iframe, HIDDEN);
      }
    }
  }
}

const isStoryChanged = ({ type }: ChannelEvent) => type === STORY_CHANGED;

const bySeen = (a: Frame, b: Frame) => a.seenAt - b.seenAt;

// The event that ends the render of `entry` in a preview: '*' is whatever the preview picks.
const rendered =
  (entry: FramePoolEntry) =>
  ({ type, args = [] }: ChannelEvent) => {
    if (FAILURES.has(type) || type === STORY_UNCHANGED) {
      return true;
    }
    const matches = (id: unknown) => entry.id === '*' || id === entry.id;
    if (type === DOCS_RENDERED) {
      return (entry.viewMode === 'docs' || entry.id === '*') && matches(args[0]);
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
