import { background, color, typography } from '../base';
import type { ThemeVars } from '../types';

const theme: ThemeVars = {
  base: 'light',

  // Storybook-specific color palette
  colorPrimary: '#FF4785', // coral
  colorSecondary: '#029CFD', // ocean

  // UI
  appBg: background.app,
  appContentBg: color.lightest,
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
  barTextColor: color.mediumdark,
  barHoverColor: color.secondary,
  barSelectedColor: color.secondary,
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
};

export default theme;
