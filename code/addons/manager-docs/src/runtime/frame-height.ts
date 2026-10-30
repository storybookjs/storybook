import type { StoryFrameHeight } from '../parser/types.ts';

export const COMPACT_FRAME_MIN_HEIGHT = 200;

export const DOCS_ARTICLE_ALIGN = {
  alignSelf: 'start',
  justifySelf: 'stretch',
  width: '100%',
} as const;

export type ExplicitFrameHeight = StoryFrameHeight;

export type FrameHeightState = {
  applied: number;
  reported: number | null;
  growth: number;
};

// The article is one of these heights and is taller than the preview pane.
export function stablePaneHeight(heights: number[]): number {
  const positive = heights.filter((height) => Number.isFinite(height) && height > 0);
  if (positive.length === 0) {
    return 0;
  }
  return Math.round(Math.min(...positive));
}

export function viewportFrameHeight(viewportHeight: number): number {
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    return COMPACT_FRAME_MIN_HEIGHT;
  }
  return Math.round(viewportHeight);
}

export function ratioFrameHeight(width: number, ratio: number): number {
  return width / ratio;
}

export function storyFrameStyle(
  explicit: ExplicitFrameHeight | undefined,
  ratio: number | undefined,
  contentHeight: number | undefined,
  viewportHeight: number
): { height: number } | { height: 'auto'; aspectRatio: number } {
  if (typeof ratio === 'number' && Number.isFinite(ratio) && ratio > 0) {
    return { height: 'auto', aspectRatio: ratio };
  }
  return { height: displayedFrameHeight(explicit, contentHeight, viewportHeight) };
}

export function displayedFrameHeight(
  explicit: ExplicitFrameHeight | undefined,
  contentHeight: number | undefined,
  viewportHeight: number
): number {
  if (explicit === '100vh') {
    return viewportFrameHeight(viewportHeight);
  }
  if (typeof explicit === 'number') {
    return explicit;
  }
  if (contentHeight === undefined || !Number.isFinite(contentHeight) || contentHeight < 0) {
    return COMPACT_FRAME_MIN_HEIGHT;
  }
  return Math.max(COMPACT_FRAME_MIN_HEIGHT, Math.ceil(contentHeight));
}

export function applyReportedHeight(
  state: FrameHeightState,
  explicit: ExplicitFrameHeight | undefined,
  reported: number,
  viewportHeight: number,
  ratio?: number
): { state: FrameHeightState; changed: boolean } {
  if (typeof ratio === 'number' && Number.isFinite(ratio) && ratio > 0) {
    return { state, changed: false };
  }
  if (typeof explicit === 'number') {
    if (state.applied === explicit) {
      return { state, changed: false };
    }
    return {
      state: { applied: explicit, reported: null, growth: 0 },
      changed: true,
    };
  }
  if (explicit === '100vh') {
    const applied = viewportFrameHeight(viewportHeight);
    return {
      state: { applied, reported: state.reported, growth: 0 },
      changed: applied !== state.applied,
    };
  }
  if (typeof reported !== 'number' || !Number.isFinite(reported) || reported < 0) {
    return { state, changed: false };
  }
  // The document grew by the same amount as the frame, so this report is the frame measuring itself.
  if (state.reported !== null && state.growth > 0 && reported - state.reported === state.growth) {
    return {
      state: { applied: state.applied, reported, growth: state.growth },
      changed: false,
    };
  }
  const next = Math.max(COMPACT_FRAME_MIN_HEIGHT, Math.ceil(reported));
  if (next === state.applied) {
    return { state: { ...state, reported }, changed: false };
  }
  return {
    state: { applied: next, reported, growth: next - state.applied },
    changed: true,
  };
}

export function nextContentReport(
  previous: number | null,
  measured: number | null,
  frameViewport: number
): number | null {
  if (
    measured === null ||
    typeof measured !== 'number' ||
    !Number.isFinite(measured) ||
    measured <= 0
  ) {
    return null;
  }
  const height = Math.ceil(measured);
  const viewport = Math.ceil(frameViewport);
  if (viewport > 0 && height === viewport) {
    return null;
  }
  if (previous !== null && height === previous) {
    return null;
  }
  return height;
}
