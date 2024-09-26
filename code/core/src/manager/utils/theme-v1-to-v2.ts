import { css, themes } from '@storybook/core/theming';
import type { ThemeVars } from '@storybook/core/theming';

export const isThemeDifferentFromDefaultTheme = (base: 'light' | 'dark', theme: ThemeVars) => {
  if (!theme) {
    return false;
  }

  const defaultTheme = themes[base];
  const themeKeys = Object.keys(theme) as (keyof ThemeVars)[];

  return themeKeys.some((key) => theme[key] !== defaultTheme[key]);
};

export const checkThemeVersion = (theme: ThemeVars): 1 | 2 => {
  const isUsingLightThemeV1 = isThemeDifferentFromDefaultTheme('light', theme);
  const isUsingDarkThemeV1 = isThemeDifferentFromDefaultTheme('dark', theme);

  return isUsingLightThemeV1 || isUsingDarkThemeV1 ? 1 : 2;
};

export const convertThemeV1intoV2 = (theme: ThemeVars) => {
  return css`
    @media (prefers-color-scheme: light) {
      :root {
        --sb-accent: ${theme.colorSecondary};
      }
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --sb-accent: ${theme.colorSecondary};
      }
    }
  `;
};
