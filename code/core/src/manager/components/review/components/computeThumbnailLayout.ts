export type ThumbnailLayout = {
  scale: number;
  aspectRatio: string;
};

export const IFRAME_RESIZE_CONTEXT = 'iframe.resize';

const NARROW_CONTENT_WIDTH = 300;
const SHORT_SCALED_HEIGHT = 133;
const TALL_SCALED_HEIGHT = 250;

/**
 * Derive thumbnail scale and frame aspect ratio from measured preview content.
 */
export const computeThumbnailLayout = ({
  width,
  height,
}: {
  width: number;
  height: number;
}): ThumbnailLayout => {
  const scale = width <= NARROW_CONTENT_WIDTH ? 1 : 0.5;
  const scaledHeight = height * scale;

  if (scaledHeight <= SHORT_SCALED_HEIGHT) {
    return { scale, aspectRatio: '2 / 1' };
  }
  if (scaledHeight >= TALL_SCALED_HEIGHT) {
    return { scale, aspectRatio: '3 / 4' };
  }
  return { scale, aspectRatio: '3 / 2' };
};

export const parseIframeResizeMessage = (
  data: unknown
): { width: number; height: number } | null => {
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
