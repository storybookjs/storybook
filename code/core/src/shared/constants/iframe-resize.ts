import { RESPONSIVE_VIEWPORT_VALUE } from '../../viewport/constants.ts';

/** postMessage `context` for embed iframe content dimension updates (preview → parent). */
export const IFRAME_RESIZE_CONTEXT = 'iframe.resize';

/** Parent → preview: re-send the last embed content dimensions. */
export const IFRAME_RESIZE_REQUEST_CONTEXT = 'iframe.resize.request';

export type IframeResizeViewport = {
  name: string;
  value: string;
  width?: number;
  height?: number;
};

export type IframeResizePayload = {
  src: string;
  context: typeof IFRAME_RESIZE_CONTEXT;
  width: number;
  height: number;
  viewport?: IframeResizeViewport;
};

export type IframeResizeDimensions = Pick<IframeResizePayload, 'width' | 'height' | 'viewport'>;

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

/** Validates an `iframe.resize` postMessage payload from an embed preview. */
export const parseIframeResizeMessage = (data: unknown): IframeResizeDimensions | null => {
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

export const hasFixedViewportDimensions = (
  viewport: IframeResizeViewport | undefined
): viewport is IframeResizeViewport & {
  width: number;
  height: number;
} =>
  !!viewport &&
  viewport.value !== RESPONSIVE_VIEWPORT_VALUE &&
  typeof viewport.width === 'number' &&
  viewport.width > 0 &&
  typeof viewport.height === 'number' &&
  viewport.height > 0;

export const iframeResizeViewportsEqual = (
  left: IframeResizeViewport | undefined,
  right: IframeResizeViewport | undefined
): boolean => {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return !left && !right;
  }
  return (
    left.name === right.name &&
    left.value === right.value &&
    left.width === right.width &&
    left.height === right.height
  );
};

export const iframeResizeDimensionsEqual = (
  left: IframeResizeDimensions | null | undefined,
  right: IframeResizeDimensions
): boolean => {
  if (!left) {
    return false;
  }
  if (left.width !== right.width || left.height !== right.height) {
    return false;
  }
  return iframeResizeViewportsEqual(left.viewport, right.viewport);
};
