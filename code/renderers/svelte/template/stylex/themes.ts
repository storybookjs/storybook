import * as stylex from '@stylexjs/stylex';

import { tokens } from './tokens.stylex';

export const lightTheme = stylex.createTheme(tokens, {
  accent: '#be123c',
  surface: '#ffffff',
  text: '#111827',
});

export const darkTheme = stylex.createTheme(tokens, {
  accent: '#fb7185',
  surface: '#111827',
  text: '#f9fafb',
});

export const themes = { light: lightTheme, dark: darkTheme };

export type ThemeName = keyof typeof themes;
