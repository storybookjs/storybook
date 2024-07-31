import { useEffect } from 'storybook/internal/preview-api';
import type { DecoratorFunction, Renderer } from 'storybook/internal/types';

import { initializeThemeState, pluckThemeFromContext, useThemeParameters } from './helpers';

export interface ClassNameStrategyConfiguration {
  themes: Record<string, string>;
  defaultTheme: string;
  parentSelector?: string;
}

const DEFAULT_ELEMENT_SELECTOR = 'html';

const classStringToArray = (classString: string) => classString.split(' ').filter(Boolean);

// TODO check with @kasperpeulen: change the types so they can be correctly inferred from context e.g. <Story extends (...args: any[]) => any>
export const withThemeByClassName = <TRenderer extends Renderer = any>({
  themes,
  defaultTheme,
  parentSelector = DEFAULT_ELEMENT_SELECTOR,
}: ClassNameStrategyConfiguration): DecoratorFunction<TRenderer> => {
  initializeThemeState(Object.keys(themes), defaultTheme);

  return (storyFn, context) => {
    const { themeOverride } = useThemeParameters();
    const selected = pluckThemeFromContext(context);

    useEffect(() => {
      const selectedThemeName = themeOverride || selected || defaultTheme;
      const parentElement = document.querySelector(parentSelector);

      if (!parentElement) {
        return;
      }

      Object.entries(themes)
        .filter(([themeName]) => themeName !== selectedThemeName)
        .forEach(([themeName, className]) => {
          const classes = classStringToArray(className);
          if (classes.length > 0) {
            parentElement.classList.remove(...classes);
          }
        });

      const newThemeClasses = classStringToArray(themes[selectedThemeName]);

      if (newThemeClasses.length > 0) {
        parentElement.classList.add(...newThemeClasses);
      }
    }, [themeOverride, selected, parentSelector]);

    return storyFn();
  };
};
