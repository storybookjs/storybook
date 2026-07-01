import { IFRAME_RESIZE_CONTEXT } from '../../../../shared/constants/iframe-resize.ts';

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
    if (
      typeof parsed.width !== 'number' ||
      !Number.isFinite(parsed.width) ||
      parsed.width <= 0 ||
      typeof parsed.height !== 'number' ||
      !Number.isFinite(parsed.height) ||
      parsed.height <= 0
    ) {
      return null;
    }
    return { width: parsed.width, height: parsed.height };
  } catch {
    return null;
  }
};

export const THUMBNAIL_SCALE_MIN = 0.5;
const THUMBNAIL_SCALE_STEP = 0.25;

/** Pre-measurement scale so the embed iframe viewport is 2× the frame width (100% / 0.5). */
export const THUMBNAIL_BOOTSTRAP_SCALE = THUMBNAIL_SCALE_MIN;

/** Mirrors Frame `--scale`: fit content width in the frame; tall content is cropped. */
export const computeThumbnailScale = (contentWidth: number, frameWidth: number): number => {
  if (frameWidth <= 0 || contentWidth <= 0) {
    return 1;
  }
  const fit = Math.min(1, frameWidth / contentWidth);
  const stepped = Math.floor(fit / THUMBNAIL_SCALE_STEP) * THUMBNAIL_SCALE_STEP;
  return Math.max(THUMBNAIL_SCALE_MIN, Math.min(1, stepped));
};
