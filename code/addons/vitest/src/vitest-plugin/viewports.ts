import type { Globals, Parameters } from 'storybook/internal/csf';
import { UnsupportedViewportDimensionError } from 'storybook/internal/preview-errors';

import { MINIMAL_VIEWPORTS } from 'storybook/viewport';
import type { ViewportMap } from 'storybook/viewport';

import type { VitestBrowserContext } from './types';

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

const validPixelOrNumber = /^\d+(px)?$/;
const percentagePattern = /^(\d+(\.\d+)?%)$/;
const vwPattern = /^(\d+(\.\d+)?vw)$/;
const vhPattern = /^(\d+(\.\d+)?vh)$/;
const emRemPattern = /^(\d+)(em|rem)$/;

const parseDimension = (value: string, dimension: 'width' | 'height') => {
  if (validPixelOrNumber.test(value)) {
    return Number.parseInt(value, 10);
  } else if (percentagePattern.test(value)) {
    const percentageValue = parseFloat(value) / 100;
    return Math.round(DEFAULT_VIEWPORT_DIMENSIONS[dimension] * percentageValue);
  } else if (vwPattern.test(value)) {
    const vwValue = parseFloat(value) / 100;
    return Math.round(DEFAULT_VIEWPORT_DIMENSIONS.width * vwValue);
  } else if (vhPattern.test(value)) {
    const vhValue = parseFloat(value) / 100;
    return Math.round(DEFAULT_VIEWPORT_DIMENSIONS.height * vhValue);
  } else if (emRemPattern.test(value)) {
    const emRemValue = Number.parseInt(value, 10);
    return emRemValue * 16;
  } else {
    throw new UnsupportedViewportDimensionError({ dimension, value });
  }
};

export const setViewport = async (parameters: Parameters = {}, globals: Globals = {}) => {
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

  // @ts-expect-error - This is an internal alias that will be resolved by the vitest plugin at runtime
  const { page } = (await import('@storybook/addon-vitest/internal/vitest-context').catch(() => ({
    page: null,
  }))) as unknown as VitestBrowserContext;

  if (!page || !globalThis.__vitest_browser__) {
    return;
  }

  const options: ViewportMap = {
    ...MINIMAL_VIEWPORTS,
    ...viewportsParam.viewports,
    ...viewportsParam.options,
  };

  let viewportWidth = DEFAULT_VIEWPORT_DIMENSIONS.width;
  let viewportHeight = DEFAULT_VIEWPORT_DIMENSIONS.height;

  if (defaultViewport && defaultViewport in options) {
    const { styles } = options[defaultViewport];
    if (styles?.width && styles?.height) {
      const { width, height } = styles;
      viewportWidth = parseDimension(width, 'width');
      viewportHeight = parseDimension(height, 'height');
    }
  }

  await page.viewport(viewportWidth, viewportHeight);
};
