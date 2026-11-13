import type { DecoratorFunction, Renderer } from 'storybook/internal/types';

import { useEffect } from 'storybook/preview-api';

import { PARAM_KEY } from '../constants.ts';
import { initializeThemeState, pluckThemeFromContext } from './helpers.ts';

export interface DataAttributeStrategyConfiguration {
  themes: Record<string, string>;
  defaultTheme: string;
  parentSelector?: string;
  attributeName?: string;
}

const DEFAULT_ELEMENT_SELECTOR = 'html';
const DEFAULT_DATA_ATTRIBUTE = 'data-theme';

// TODO check with @kasperpeulen: change the types so they can be correctly inferred from context e.g. <Story extends (...args: any[]) => any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const withThemeByDataAttribute = <TRenderer extends Renderer = any>({
  themes,
  defaultTheme,
  parentSelector = DEFAULT_ELEMENT_SELECTOR,
  attributeName = DEFAULT_DATA_ATTRIBUTE,
}: DataAttributeStrategyConfiguration): DecoratorFunction<TRenderer> => {
  initializeThemeState(Object.keys(themes), defaultTheme);
  return (storyFn, context) => {
    const { themeOverride } = context.parameters[PARAM_KEY] ?? {};
    const selected = pluckThemeFromContext(context);

    useEffect(() => {
      const parentElement = document.querySelector(parentSelector);
      const themeKey = themeOverride || selected || defaultTheme;
      const docsElement =
        context.viewMode === 'docs' ? document.querySelector('#storybook-docs') : null;

      [parentElement, docsElement].forEach((element) => {
        if (element) {
          element.setAttribute(attributeName, themes[themeKey]);
        }
      });
    }, [themeOverride, selected, context.viewMode]);

    return storyFn();
  };
};
