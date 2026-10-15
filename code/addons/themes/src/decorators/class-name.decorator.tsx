import type { DecoratorFunction, Renderer } from 'storybook/internal/types';

import { useEffect } from 'storybook/preview-api';

import { PARAM_KEY } from '../constants.ts';
import { initializeThemeState, pluckThemeFromContext } from './helpers.ts';

export interface ClassNameStrategyConfiguration {
  themes: Record<string, string>;
  defaultTheme: string;
  parentSelector?: string;
}

const DEFAULT_ELEMENT_SELECTOR = 'html';

const classStringToArray = (classString: string) => classString.split(' ').filter(Boolean);

// TODO check with @kasperpeulen: change the types so they can be correctly inferred from context e.g. <Story extends (...args: any[]) => any>
export const withThemeByClassName = <TRenderer extends Renderer = Renderer>({
  themes,
  defaultTheme,
  parentSelector = DEFAULT_ELEMENT_SELECTOR,
}: ClassNameStrategyConfiguration): DecoratorFunction<TRenderer> => {
  initializeThemeState(Object.keys(themes), defaultTheme);

  return (storyFn, context) => {
    const { themeOverride } = context.parameters[PARAM_KEY] ?? {};
    const selected = pluckThemeFromContext(context);

    useEffect(() => {
      const selectedThemeName = themeOverride || selected || defaultTheme;
      const parentElement = document.querySelector(parentSelector);
      const docsElement =
        context.viewMode === 'docs' ? document.querySelector('#storybook-docs') : null;

      const elements = [parentElement, docsElement].filter(Boolean) as Element[];

      elements.forEach((element) => {
        Object.entries(themes)
          .filter(([themeName]) => themeName !== selectedThemeName)
          .forEach(([, className]) => {
            const classes = classStringToArray(className);
            if (classes.length > 0) {
              element.classList.remove(...classes);
            }
          });

        const newThemeClasses = classStringToArray(themes[selectedThemeName]);

        if (newThemeClasses.length > 0) {
          element.classList.add(...newThemeClasses);
        }
      });
    }, [themeOverride, selected, context.viewMode]);
    return storyFn();
  };
};
