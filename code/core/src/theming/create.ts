// This generates theme variables in the correct shape for the UI
import lightThemeVars from './themes/light';
import darkThemeVars from './themes/dark';

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
  [key: string]: any;
}

export const create = (
  vars: ThemeVarsPartial = { base: preferredColorScheme },
  rest?: Rest
): ThemeVars => {
  const inherit: ThemeVars = {
    ...themes[preferredColorScheme],
    ...(themes[vars.base] || {}),
    ...vars,
    ...{ base: themes[vars.base] ? vars.base : preferredColorScheme },
  };
  return {
    ...rest,
    ...inherit,
    ...{ barSelectedColor: vars.barSelectedColor || inherit.colorSecondary },
  };
};
