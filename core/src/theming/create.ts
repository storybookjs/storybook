// This generates theme variables in the correct shape for the UI
import darkThemeVars from './themes/dark';
import lightThemeVars from './themes/light';
import type { ThemeVars, ThemeVarsPartial } from './types';
import { getPreferredColorScheme } from './utils';

interface Themes {
  light: ThemeVars;
  dark: ThemeVars;
  normal: ThemeVars;
}

const themesBase: Omit<Themes, 'normal'> = {
  light: lightThemeVars,
  dark: darkThemeVars,
};

const preferredColorScheme = getPreferredColorScheme();

export const themes: Themes = {
  ...themesBase,
  normal: themesBase[preferredColorScheme],
};

interface Rest {
  [key: string]: unknown;
}

export const create = (
  vars: ThemeVarsPartial = {
    base: preferredColorScheme,
  },
  rest?: Rest
): ThemeVars => {
  const inherit: ThemeVars = {
    // We always inherit the preferred color scheme.
    ...themes[preferredColorScheme],
    // And then the declared theme base if it exists.
    ...(themes[vars.base] || {}),
    // And then the actual theme content.
    ...vars,
    // If no theme base was declared, we declare the preferred color scheme as the base.
    base: themes[vars.base] ? vars.base : preferredColorScheme,
  };
  return {
    ...rest,
    ...inherit,
    barSelectedColor: vars.barSelectedColor || inherit.colorSecondary,
  };
};
