// This generates theme variables in the correct shape for the UI
import lightThemeVars from './themes/light';
import darkThemeVars from './themes/dark';

import type { ThemeVars, ThemeVarsPartial } from './types';
import { getPreferredColorScheme } from './utils';

export const themes: { light: ThemeVars; dark: ThemeVars; normal: ThemeVars } = {
  light: lightThemeVars,
  dark: darkThemeVars,
  normal: lightThemeVars,
};

interface Rest {
  [key: string]: any;
}

const preferredColorScheme = getPreferredColorScheme();

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
