import { IFRAME_RESIZE_CONTEXT } from '../../../../shared/constants/iframe-resize.ts';

/** Default `--content-w` before the embed iframe reports its size. */
export const DEFAULT_CONTENT_WIDTH = 300;

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

/** Pre-measurement scale so the embed iframe viewport is 2× the frame width (100% / 0.5). */
export const THUMBNAIL_BOOTSTRAP_SCALE = 0.5;
