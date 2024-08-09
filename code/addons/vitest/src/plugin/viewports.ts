/* eslint-disable no-underscore-dangle */
import type { BrowserPage } from '@vitest/browser/context';

import { INITIAL_VIEWPORTS } from '../../../viewport/src/defaults';
import type { ViewportMap, ViewportStyles } from '../../../viewport/src/types';

declare global {
  // eslint-disable-next-line no-var, @typescript-eslint/naming-convention
  var __vitest_browser__: boolean;
}

interface ViewportsParam {
  defaultViewport: string;
  viewports: ViewportMap;
}

export const setViewport = async (viewportsParam: ViewportsParam = {} as ViewportsParam) => {
  const defaultViewport = viewportsParam.defaultViewport;
  if (!defaultViewport || !globalThis.__vitest_browser__) return null;

  let page: BrowserPage;
  try {
    const vitestContext = await import('@vitest/browser/context');
    page = vitestContext.page;
  } catch (e) {
    return;
  }

  const viewports = {
    ...INITIAL_VIEWPORTS,
    ...viewportsParam.viewports,
  };

  if (defaultViewport in viewports) {
    const styles = viewports[defaultViewport].styles as ViewportStyles;
    if (styles?.width && styles?.height) {
      const { width, height } = {
        width: Number.parseInt(styles.width),
        height: Number.parseInt(styles.height),
      };
      await page.viewport(width, height);
    }
  }

  return null;
};
