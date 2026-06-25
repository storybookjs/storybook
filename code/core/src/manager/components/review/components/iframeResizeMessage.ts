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
