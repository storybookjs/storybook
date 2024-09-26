import { convert, css, themes } from '@storybook/core/theming';

import { deprecate } from '@storybook/core/client-logger';

import memoize from 'memoizerific';

import type { ThemeVars, Typography } from './types';

type Value = string | number;
interface StyleObject {
  [key: string]: Value | StyleObject;
}

export const createReset = memoize(1)(
  ({ typography }: { typography: Typography }): StyleObject => ({
    body: {
      fontFamily: typography.fonts.base,
      fontSize: typography.size.s3,
      margin: 0,

      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
      WebkitTapHighlightColor: 'rgba(0, 0, 0, 0)',
      WebkitOverflowScrolling: 'touch',
    },

    '*': {
      boxSizing: 'border-box',
    },

    'h1, h2, h3, h4, h5, h6': {
      fontWeight: typography.weight.regular,
      margin: 0,
      padding: 0,
    },

    'button, input, textarea, select': {
      fontFamily: 'inherit',
      fontSize: 'inherit',
      boxSizing: 'border-box',
    },

    sub: {
      fontSize: '0.8em',
      bottom: '-0.2em',
    },

    sup: {
      fontSize: '0.8em',
      top: '-0.2em',
    },
    'b, strong': {
      fontWeight: typography.weight.bold,
    },

    hr: {
      border: 'none',
      borderTop: '1px solid silver',
      clear: 'both',
      marginBottom: '1.25rem',
    },

    code: {
      fontFamily: typography.fonts.mono,
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
      display: 'inline-block',
      paddingLeft: 2,
      paddingRight: 2,
      verticalAlign: 'baseline',

      color: 'inherit',
    },

    pre: {
      fontFamily: typography.fonts.mono,
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
      lineHeight: '18px',
      padding: '11px 1rem',
      whiteSpace: 'pre-wrap',

      color: 'inherit',
      borderRadius: 3,
      margin: '1rem 0',
    },
  })
);

const checkThemeVersion = (theme: ThemeVars): 1 | 2 => {
  if (!theme || theme.base === 'dark') {
    return 1;
  }

  const defaultTheme = themes[theme.base];
  const defaultThemeConverted = convert(defaultTheme);

  // We are checking if the theme is different from the default theme
  // If it is, this mean that the user is using the V1 theme
  return JSON.stringify(theme) !== JSON.stringify(defaultThemeConverted) ? 1 : 2;
};

export const createGlobal = memoize(1)((theme): StyleObject => {
  const themeVersion = checkThemeVersion(theme);
  const resetStyles: StyleObject = createReset({ typography: theme.typography });

  if (themeVersion === 1) {
    deprecate('Use of deprecated theme format detected. Please migrate to the new format.');
  }

  return {
    ...resetStyles,

    '@layer storybook': {
      ':root': {
        '--sb-accent': themeVersion === 1 ? theme.color.secondary : '#029cfd',
      },
      '@media (prefers-color-scheme: dark)': {
        ':root': {
          '--sb-accent': themeVersion === 1 ? theme.color.secondary : '#150a8d',
        },
      },
    },

    body: {
      ...(resetStyles.body as StyleObject),
      color: theme.color.defaultText,
      background: theme.background.app,
      overflow: 'hidden',
    },

    hr: {
      ...(resetStyles.hr as StyleObject),
      borderTop: `1px solid ${theme.color.border}`,
    },
  };
});
