import type { Globals, Parameters, StoryId } from 'storybook/internal/types';

/** The query parameter that marks a preview as a frame of the manager's pool. */
export const FRAME_POOL_PARAM = 'framePool';

/** Marks an iframe of the manager's pool. */
export const POOL_FRAME_ATTRIBUTE = 'data-storybook-pool-frame';

/**
 * Marks the shown frame of the pool while the manager does not hear it yet: until its preview set
 * the story it switches to, as what it reports before is of the story it showed; and until the pool
 * handed the manager what the frame reported before it was shown, in order.
 */
export const POOL_FRAME_REPLAY_ATTRIBUTE = 'data-storybook-pool-frame-replay';

/** Docs frame → manager: the story blocks of its docs page that want a frame, and where they lie. */
export const FRAME_POOL_LAYOUT = 'storybook/frame-pool/layout';

/** Manager → docs frame: whether a frame shows the story over a block. */
export const FRAME_POOL_SHOWN = 'storybook/frame-pool/shown';

export interface FramePoolRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface FramePoolSlot {
  id: string;
  storyId: StoryId;
  globals: Globals;
  autoplay: boolean;
  // In the coordinates of the docs document, which does not scroll.
  rect: FramePoolRect;
}

export interface FramePoolLayout {
  slots: FramePoolSlot[];
}

export interface FramePoolShown {
  id: string;
  shown: boolean;
}

export interface FramePoolOptions {
  size: number;
  max: number;
  mobileMax: number;
}

/** The options of `features.experimentalFramePool`, or `undefined` when it is off. */
export const getFramePoolOptions = (
  feature: boolean | Partial<FramePoolOptions> | undefined
): FramePoolOptions | undefined => {
  if (!feature) {
    return undefined;
  }
  const options = typeof feature === 'object' ? feature : {};
  const size = options.size || 2;
  return {
    size,
    max: Math.max(options.max || 10, size),
    mobileMax: options.mobileMax || Math.min(3, Math.max(options.max || 10, size)),
  };
};

/**
 * Whether a story renders in a frame of its own: as docs decide to show it in an iframe, by its
 * layout or `docs.story.inline`.
 */
export const rendersInFrame = (parameters: Parameters) =>
  parameters.layout === 'document' || parameters.docs?.story?.inline === false;
