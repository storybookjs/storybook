import { background, color, typography } from '../base';
import type { ThemeVars } from '../types';

const theme: ThemeVars = {
  base: 'light',

  // Storybook-specific color palette
  colorPrimary: color.primary,
  colorSecondary: color.secondary,

  // UI
  appBg: background.app,
  appContentBg: color.lightest,
  appHoverBg: '#DBECFF',
  appPreviewBg: color.lightest,
  appBorderColor: color.border,
  appBorderRadius: 4,

  // Fonts
  fontBase: typography.fonts.base,
  fontCode: typography.fonts.mono,

  // Text colors
  textColor: color.darkest,
  textInverseColor: color.lightest,
  textMutedColor: color.dark,

  // Toolbar default and active colors
  barTextColor: color.dark,
  barHoverColor: '#005CC7',
  barSelectedColor: '#0063D6',
  barBg: color.lightest,

  // Form colors
  buttonBg: background.app,
  buttonBorder: color.medium,
  booleanBg: color.mediumlight,
  booleanSelectedBg: color.lightest,
  inputBg: color.lightest,
  inputBorder: color.border,
  inputTextColor: color.darkest,
  inputBorderRadius: 4,

  // Highlight styles
  highlightOpacity: 0.85,
};

export default theme;
