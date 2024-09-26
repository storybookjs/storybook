import { convert, css, themes } from '@storybook/core/theming';
import type { ThemeVars } from '@storybook/core/theming';

export const checkThemeVersion = (theme: ThemeVars): 1 | 2 => {
  if (!theme || theme.base === 'dark') {
    return 1;
  }

  const defaultTheme = themes[theme.base];
  const defaultThemeConverted = convert(defaultTheme);

  // We are checking if the theme is different from the default theme
  const isThemeDifferent = JSON.stringify(theme) !== JSON.stringify(defaultThemeConverted);

  // If it is, this mean that the user is using the V1 theme
  return isThemeDifferent ? 1 : 2;
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
