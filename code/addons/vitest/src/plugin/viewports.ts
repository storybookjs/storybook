/* eslint-disable no-underscore-dangle */
import { UnsupportedViewportDimensionError } from 'storybook/internal/preview-errors';

import { page } from '@vitest/browser/context';

import { INITIAL_VIEWPORTS } from '../../../viewport/src/defaults';
import type { ViewportMap, ViewportStyles } from '../../../viewport/src/types';

declare global {
  // eslint-disable-next-line no-var, @typescript-eslint/naming-convention
  var __vitest_browser__: boolean;
}

export interface ViewportsParam {
  defaultViewport: string;
  viewports: ViewportMap;
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

export const setViewport = async (viewportsParam: ViewportsParam = {} as ViewportsParam) => {
  const defaultViewport = viewportsParam.defaultViewport;

  if (!page || !globalThis.__vitest_browser__ || !defaultViewport) {
    return;
  }

  const viewports = {
    ...INITIAL_VIEWPORTS,
    ...viewportsParam.viewports,
  };

  let viewportWidth = DEFAULT_VIEWPORT_DIMENSIONS.width;
  let viewportHeight = DEFAULT_VIEWPORT_DIMENSIONS.height;

  if (defaultViewport in viewports) {
    const styles = viewports[defaultViewport].styles as ViewportStyles;
    if (styles?.width && styles?.height) {
      const { width, height } = styles;
      viewportWidth = parseDimension(width, 'width');
      viewportHeight = parseDimension(height, 'height');
    }
  }

  await page.viewport(viewportWidth, viewportHeight);
};
