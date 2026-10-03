import React from 'react';

import type { Decorator } from '@storybook/react';

import * as stylex from '@stylexjs/stylex';

import { type ThemeName, themes } from './themes';

/** Applies a `createTheme` theme from the `stylexTheme` global, or `parameters.stylexTheme`. */
export const withStylexTheme: Decorator = (Story, { globals, parameters }) => {
  const theme: ThemeName = parameters.stylexTheme ?? globals.stylexTheme ?? 'light';
  return (
    <div {...stylex.props(themes[theme])}>
      <Story />
    </div>
  );
};
