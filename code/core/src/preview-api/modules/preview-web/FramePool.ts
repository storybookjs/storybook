import type { Channel } from 'storybook/internal/channels';
import type { Globals, StoryId } from 'storybook/internal/types';

import {
  FRAME_POOL_LAYOUT,
  FRAME_POOL_PARAM,
  FRAME_POOL_SHOWN,
  type FramePoolLayout,
  type FramePoolShown,
  type FramePoolSlot,
  getFramePoolOptions,
} from '../../../shared/constants/frame-pool.ts';
import { IFRAME_RESIZE_CONTEXT } from '../../../shared/constants/iframe-resize.ts';
import { addons } from '../addons/index.ts';

export { rendersInFrame } from '../../../shared/constants/frame-pool.ts';

export interface FrameLeaseRequest {
  storyId: StoryId;
  /** The user globals the story renders with. */
  globals: Globals;
  autoplay: boolean;
  /** The element of the docs page that the frame lies over. */
  place: HTMLElement;
  /** Called with `true` once a frame shows the story over `place`, and `false` when it left. */
  onShow?: (shown: boolean) => void;
}

export interface FrameLease {
  release: () => void;
}

interface Lease extends FrameLeaseRequest {
  id: string;
}

// A docs page in a frame of the pool does not scroll: the manager sizes the frame to its content
// and scrolls it, with the frames over its story blocks. The docs wrapper fills the window at
// least, which would keep the frame from ever getting smaller.
const DOCS_STYLE = `
  html:has(#storybook-docs:not([hidden])) { overflow: hidden; }
  #storybook-docs .sbdocs-wrapper { min-height: 0; }
`;

/**
 * The manager's pool of preview frames, as a docs page in one of them sees it: a story block asks
 * for a frame of its own, which the manager lays over the block.
 */
export class FramePoolClient {
  private leases = new Map<string, Lease>();

  private nextId = 0;

  private reportScheduled = false;

  private lastLayout = '[]';

  private lastHeight = 0;

  private readonly resizeObserver = new ResizeObserver(() => this.scheduleReport());

  constructor(private readonly channel: Channel) {
    channel.on(FRAME_POOL_SHOWN, ({ id, shown }: FramePoolShown) =>
      this.leases.get(id)?.onShow?.(shown)
    );
    const style = document.createElement('style');
    style.textContent = DOCS_STYLE;
    document.head.append(style);
    this.resizeObserver.observe(document.body);
    new MutationObserver(() => this.scheduleReport()).observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  lease(request: FrameLeaseRequest): FrameLease {
    const lease = { ...request, id: `${(this.nextId += 1)}` };
    this.leases.set(lease.id, lease);
    this.resizeObserver.observe(lease.place);
    this.scheduleReport();
    return {
      release: () => {
        if (this.leases.delete(lease.id)) {
          this.resizeObserver.unobserve(lease.place);
          this.scheduleReport();
        }
      },
    };
  }

  private scheduleReport() {
    if (this.reportScheduled) {
      return;
    }
    this.reportScheduled = true;
    requestAnimationFrame(() => {
      this.reportScheduled = false;
      this.report();
    });
  }

  // Reports where the story blocks lie, and how tall the docs page is, when either changed.
  private report() {
    const slots = [...this.leases.values()]
      .filter(({ place }) => place.isConnected)
      .map(({ id, storyId, globals, autoplay, place }): FramePoolSlot => {
        const rect = place.getBoundingClientRect();
        return {
          id,
          storyId,
          globals,
          autoplay,
          rect: {
            top: Math.round(rect.top + scrollY),
            left: Math.round(rect.left + scrollX),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
        };
      });
    const layout = JSON.stringify(slots);
    if (layout !== this.lastLayout) {
      this.lastLayout = layout;
      this.channel.emit(FRAME_POOL_LAYOUT, { slots } satisfies FramePoolLayout);
    }

    const docs = document.getElementById('storybook-docs');
    if (!docs || docs.hidden) {
      return;
    }
    const { paddingBottom, marginBottom } = getComputedStyle(document.body);
    const rect = docs.getBoundingClientRect();
    const height = Math.ceil(
      rect.bottom + scrollY + (parseFloat(paddingBottom) || 0) + (parseFloat(marginBottom) || 0)
    );
    if (height > 0 && height !== this.lastHeight) {
      this.lastHeight = height;
      parent.postMessage(
        JSON.stringify({
          src: location.toString(),
          context: IFRAME_RESIZE_CONTEXT,
          width: Math.max(1, Math.ceil(rect.width)),
          height,
        }),
        location.origin
      );
    }
  }
}

let client: FramePoolClient | undefined;

/**
 * The manager's pool of frames, with `features.experimentalFramePool` on, as a docs page in one of
 * its frames reaches it. Elsewhere there is none.
 */
export const getFramePool = (): FramePoolClient | undefined => {
  if (
    !getFramePoolOptions(globalThis.FEATURES?.experimentalFramePool) ||
    typeof document === 'undefined' ||
    !new URLSearchParams(location.search).has(FRAME_POOL_PARAM)
  ) {
    return undefined;
  }
  client ??= new FramePoolClient(addons.getChannel());
  return client;
};
