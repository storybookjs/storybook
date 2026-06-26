export const IFRAME_RESIZE_CONTEXT = 'iframe.resize';

/** Default `--content-w` / `--content-h` before the embed iframe reports its size. */
export const DEFAULT_CONTENT_WIDTH = 300;
export const DEFAULT_CONTENT_HEIGHT = 200;

export type ContentDimensions = {
  width: number;
  height: number;
};

export const parseIframeResizeMessage = (data: unknown): ContentDimensions | null => {
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    if (parsed?.context !== IFRAME_RESIZE_CONTEXT) {
      return null;
    }
    if (typeof parsed.width !== 'number' || typeof parsed.height !== 'number') {
      return null;
    }
    return { width: parsed.width, height: parsed.height };
  } catch {
    return null;
  }
};

const THUMBNAIL_THIRDS_MAX = 4;
const THUMBNAIL_SCALE_MIN = 0.5;
const THUMBNAIL_SCALE_STEP = 0.25;

/** Mirrors Frame `--scale`: fit width, then round down to 0.25 steps (floor 0.5). */
export const computeThumbnailScale = (contentWidth: number, frameWidth: number): number => {
  if (frameWidth <= 0 || contentWidth <= 0) {
    return 1;
  }
  const fit = Math.min(1, frameWidth / contentWidth);
  const stepped = Math.floor(fit / THUMBNAIL_SCALE_STEP) * THUMBNAIL_SCALE_STEP;
  return Math.max(THUMBNAIL_SCALE_MIN, Math.min(1, stepped));
};

/** Mirrors Frame `--thirds`: smallest 3/n bucket that fits scaled content height. */
export const computeThumbnailThirds = (
  contentWidth: number,
  contentHeight: number,
  frameWidth: number
): number => {
  if (frameWidth <= 0 || contentWidth <= 0 || contentHeight <= 0) {
    return 2;
  }
  const scale = computeThumbnailScale(contentWidth, frameWidth);
  const scaledHeight = contentHeight * scale;
  const thirds = Math.ceil((3 * scaledHeight) / frameWidth);
  return Math.min(THUMBNAIL_THIRDS_MAX, Math.max(1, thirds));
};

/** Minimum preview frame height for a cell width and reported iframe content size. */
export const computeThumbnailMinHeight = (
  contentWidth: number,
  contentHeight: number,
  frameWidth: number
): number => {
  const thirds = computeThumbnailThirds(contentWidth, contentHeight, frameWidth);
  return (frameWidth * thirds) / 3;
};
