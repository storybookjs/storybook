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
