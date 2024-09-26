import { css, themes } from '@storybook/core/theming';
import type { ThemeVars } from '@storybook/core/theming';

export const checkThemeVersion = (theme: ThemeVars): 1 | 2 => {
  if (!theme || theme.base === 'dark') {
    return 1;
  }

  const defaultTheme = themes[theme.base];
  const themeKeys = Object.keys(theme) as (keyof ThemeVars)[];
  const isThemeDifferentFromDefaultTheme = themeKeys.some(
    (key) => theme[key] !== defaultTheme[key]
  );

  return isThemeDifferentFromDefaultTheme ? 1 : 2;
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
