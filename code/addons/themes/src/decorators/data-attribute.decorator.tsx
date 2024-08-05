import { useEffect } from 'storybook/internal/preview-api';
import type { DecoratorFunction, Renderer } from 'storybook/internal/types';
import { initializeThemeState, pluckThemeFromContext, useThemeParameters } from './helpers';

export interface DataAttributeStrategyConfiguration {
  themes: Record<string, string>;
  defaultTheme: string;
  parentSelector?: string;
  attributeName?: string;
}

const DEFAULT_ELEMENT_SELECTOR = 'html';
const DEFAULT_DATA_ATTRIBUTE = 'data-theme';

// TODO check with @kasperpeulen: change the types so they can be correctly inferred from context e.g. <Story extends (...args: any[]) => any>
export const withThemeByDataAttribute = <TRenderer extends Renderer = any>({
  themes,
  defaultTheme,
  parentSelector = DEFAULT_ELEMENT_SELECTOR,
  attributeName = DEFAULT_DATA_ATTRIBUTE,
}: DataAttributeStrategyConfiguration): DecoratorFunction<TRenderer> => {
  initializeThemeState(Object.keys(themes), defaultTheme);
  return (storyFn, context) => {
    const { themeOverride } = useThemeParameters();
    const selected = pluckThemeFromContext(context);

    useEffect(() => {
      const parentElement = document.querySelector(parentSelector);
      const themeKey = themeOverride || selected || defaultTheme;

      if (parentElement) {
        parentElement.setAttribute(attributeName, themes[themeKey]);
      }
    }, [themeOverride, selected]);

    return storyFn();
  };
};
