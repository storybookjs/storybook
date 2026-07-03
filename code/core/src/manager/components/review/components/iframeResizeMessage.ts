import type { CSSProperties } from 'react';

import {
  IFRAME_RESIZE_CONTEXT,
  hasFixedViewportDimensions,
  iframeResizeDimensionsEqual,
  iframeResizeViewportsEqual,
  type IframeResizeDimensions,
  type IframeResizeViewport,
} from '../../../../shared/constants/iframe-resize.ts';

/** Default `--content-w` before the embed iframe reports its size. */
export const DEFAULT_CONTENT_WIDTH = 300;

export type ContentDimensions = IframeResizeDimensions;

export {
  iframeResizeDimensionsEqual as contentDimensionsEqual,
  hasFixedViewportDimensions as hasFixedViewportAspect,
  iframeResizeViewportsEqual,
  type IframeResizeViewport,
};

const isPositiveFinite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const parseViewport = (value: unknown): IframeResizeViewport | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const viewport = value as Partial<IframeResizeViewport>;
  if (typeof viewport.name !== 'string' || typeof viewport.value !== 'string') {
    return undefined;
  }

  const parsed: IframeResizeViewport = {
    name: viewport.name,
    value: viewport.value,
  };

  if (viewport.width !== undefined) {
    if (!isPositiveFinite(viewport.width)) {
      return undefined;
    }
    parsed.width = viewport.width;
  }

  if (viewport.height !== undefined) {
    if (!isPositiveFinite(viewport.height)) {
      return undefined;
    }
    parsed.height = viewport.height;
  }

  return parsed;
};

export const parseIframeResizeMessage = (data: unknown): ContentDimensions | null => {
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    if (parsed?.context !== IFRAME_RESIZE_CONTEXT) {
      return null;
    }
    if (!isPositiveFinite(parsed.width) || !isPositiveFinite(parsed.height)) {
      return null;
    }

    const viewport = parseViewport(parsed.viewport);
    if (parsed.viewport !== undefined && viewport === undefined) {
      return null;
    }

    return {
      width: parsed.width,
      height: parsed.height,
      ...(viewport ? { viewport } : {}),
    };
  } catch {
    return null;
  }
};

/** Pre-measurement scale so the embed iframe viewport is 2× the frame width (100% / 0.5). */
export const THUMBNAIL_BOOTSTRAP_SCALE = 0.5;

export const getPreviewFrameStyle = (dimensions: ContentDimensions | null): CSSProperties => {
  if (!dimensions) {
    return { '--scale': THUMBNAIL_BOOTSTRAP_SCALE } as CSSProperties;
  }

  if (hasFixedViewportDimensions(dimensions.viewport)) {
    return {
      '--vp-w': dimensions.viewport.width,
      '--vp-h': dimensions.viewport.height,
    } as CSSProperties;
  }

  return { '--content-w': dimensions.width } as CSSProperties;
};
