// This generates theme variables in the correct shape for the UI
import darkThemeVars from './themes/dark';
import lightThemeVars from './themes/light';
import type { ThemeVars, ThemeVarsPartial } from './types';
import { getPreferredColorScheme } from './utils';

export const themes: { light: ThemeVars; dark: ThemeVars; normal: ThemeVars } = {
  light: lightThemeVars,
  dark: darkThemeVars,
  normal: lightThemeVars,
};

interface Rest {
  [key: string]: unknown;
}

const preferredColorScheme = getPreferredColorScheme();

export const create = (
  vars: ThemeVarsPartial = {
    base: preferredColorScheme,
  },
  rest?: Rest
): ThemeVars => {
  const base = themes[vars.base] ? vars.base : preferredColorScheme;
  const inherit: ThemeVars = {
    ...themes[preferredColorScheme],
    ...themes[vars.base],
    ...vars,
    base,
  };
  return {
    ...rest,
    ...inherit,
    barSelectedColor: vars.barSelectedColor || inherit.colorSecondary,
  };
};
