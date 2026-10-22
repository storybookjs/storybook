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
  /** The zoom of the docs block: the story shows at `1 / scale`. */
  scale?: number;
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
  const max = Math.max(1, options.max ?? 10);
  const mobileMax = Math.max(1, options.mobileMax ?? Math.min(3, max));
  // Frames that boot up front never exceed the most frames there are, on a phone too.
  return { size: Math.min(options.size ?? 2, max), max, mobileMax };
};

/**
 * Whether docs render a story in a frame of its own rather than inline, in the docs page's own
 * document: the block's `inline` prop, else `parameters.docs.story.inline`, and always for a story
 * that owns the document (`layout: 'document'`), which would own the docs page's too.
 */
export const rendersInFrame = (parameters: Parameters | undefined, inline?: boolean) =>
  parameters?.layout === 'document' ||
  !(inline ?? (parameters?.docs?.story?.inline as boolean | undefined) ?? false);
