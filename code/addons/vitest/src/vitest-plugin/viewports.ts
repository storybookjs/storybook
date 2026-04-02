import type { Globals, Parameters } from 'storybook/internal/csf';
import { UnsupportedViewportDimensionError } from 'storybook/internal/preview-errors';

import { MINIMAL_VIEWPORTS } from 'storybook/viewport';
import type { ViewportMap } from 'storybook/viewport';

import { isAutomaticScreenshotCaptureEnabled } from './screenshots';

declare global {
  // eslint-disable-next-line no-var
  var __vitest_browser__: boolean;
}

export interface ViewportsParam {
  defaultViewport?: string;
  viewports?: ViewportMap;
  options?: ViewportMap;
  disable?: boolean;
  disabled?: boolean;
}

export interface ViewportsGlobal {
  value?: string;
  disable?: boolean;
}

export const DEFAULT_VIEWPORT_DIMENSIONS = {
  width: 1200,
  height: 900,
};

export const SCREENSHOT_VIEWPORT_DIMENSIONS = {
  width: 393,
  height: 852,
};

const validPixelOrNumber = /^\d+(px)?$/;
const percentagePattern = /^(\d+(\.\d+)?%)$/;
const vwPattern = /^(\d+(\.\d+)?vw)$/;
const vhPattern = /^(\d+(\.\d+)?vh)$/;
const emRemPattern = /^(\d+)(em|rem)$/;

const parseDimension = (
  value: string,
  dimension: 'width' | 'height',
  referenceViewport: { width: number; height: number }
) => {
  if (validPixelOrNumber.test(value)) {
    return Number.parseInt(value, 10);
  } else if (percentagePattern.test(value)) {
    const percentageValue = parseFloat(value) / 100;
    return Math.round(referenceViewport[dimension] * percentageValue);
  } else if (vwPattern.test(value)) {
    const vwValue = parseFloat(value) / 100;
    return Math.round(referenceViewport.width * vwValue);
  } else if (vhPattern.test(value)) {
    const vhValue = parseFloat(value) / 100;
    return Math.round(referenceViewport.height * vhValue);
  } else if (emRemPattern.test(value)) {
    const emRemValue = Number.parseInt(value, 10);
    return emRemValue * 16;
  } else {
    throw new UnsupportedViewportDimensionError({ dimension, value });
  }
};

export const setViewport = async (parameters: Parameters = {}, globals: Globals = {}) => {
  const fallbackViewport = isAutomaticScreenshotCaptureEnabled()
    ? SCREENSHOT_VIEWPORT_DIMENSIONS
    : DEFAULT_VIEWPORT_DIMENSIONS;
  let defaultViewport;
  const viewportsParam: ViewportsParam = parameters.viewport ?? {};
  const viewportsGlobal: ViewportsGlobal = globals.viewport ?? {};
  const isDisabled = viewportsParam.disable || viewportsParam.disabled;

  // Support new setting from globals, else use the one from parameters
  if (viewportsGlobal.value && !isDisabled) {
    defaultViewport = viewportsGlobal.value;
  } else if (!isDisabled) {
    defaultViewport = viewportsParam.defaultViewport;
  }

  const { page } = await import('@vitest/browser/context').catch(() => ({
    page: null,
  }));

  if (!page || !globalThis.__vitest_browser__) {
    return;
  }

  const options: ViewportMap = {
    ...MINIMAL_VIEWPORTS,
    ...viewportsParam.viewports,
    ...viewportsParam.options,
  };

  let viewportWidth = fallbackViewport.width;
  let viewportHeight = fallbackViewport.height;

  if (defaultViewport && defaultViewport in options) {
    const { styles } = options[defaultViewport];
    if (styles?.width && styles?.height) {
      const { width, height } = styles;
      viewportWidth = parseDimension(width, 'width', fallbackViewport);
      viewportHeight = parseDimension(height, 'height', fallbackViewport);
    }
  }

  await page.viewport(viewportWidth, viewportHeight);
};
