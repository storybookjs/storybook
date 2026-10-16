import React from 'react';

import type { DecoratorFunction, Renderer } from 'storybook/internal/types';

import { useMemo } from 'storybook/preview-api';

import { PARAM_KEY } from '../../../addons/themes/src/constants.ts';
import {
  initializeThemeState,
  pluckThemeFromContext,
} from '../../../addons/themes/src/decorators/helpers.ts';

type Theme = Record<string, any>;
type ThemeMap = Record<string, Theme>;

export interface ProviderStrategyConfiguration {
  Provider?: any;
  GlobalStyles?: any;
  defaultTheme?: string;
  themes?: ThemeMap;
}

/**
 * Wrap every story in a theme provider component and let `@storybook/addon-themes` switch the theme
 * from the toolbar.
 */
export const withThemeFromJSXProvider = <TRenderer extends Renderer = any>({
  Provider,
  GlobalStyles,
  defaultTheme,
  themes = {},
}: ProviderStrategyConfiguration): DecoratorFunction<TRenderer> => {
  const themeNames = Object.keys(themes);
  const initialTheme = defaultTheme || themeNames[0];

  initializeThemeState(themeNames, initialTheme);

  const decorator: DecoratorFunction<TRenderer> = (storyFn, context) => {
    const { themeOverride } = context.parameters[PARAM_KEY] ?? {};
    const selected = pluckThemeFromContext(context);

    const theme = useMemo(() => {
      const selectedThemeName = themeOverride || selected || initialTheme;
      const pairs = Object.entries(themes);

      return pairs.length === 1 ? pairs[0][1] : themes[selectedThemeName];
    }, [selected, themeOverride]);

    if (!Provider) {
      return (
        <>
          {GlobalStyles && <GlobalStyles />}
          {storyFn()}
        </>
      );
    }

    return (
      <Provider theme={theme}>
        {GlobalStyles && <GlobalStyles />}
        {storyFn()}
      </Provider>
    );
  };

  return decorator;
};
