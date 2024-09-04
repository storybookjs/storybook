import { color, typography } from '../base';
import type { ThemeVars } from '../types';

const theme: ThemeVars = {
  base: 'dark',

  // Storybook-specific color palette
  colorPrimary: '#FF4785', // coral
  colorSecondary: '#029CFD', // ocean

  // UI
  appBg: '#222425',
  appContentBg: '#1B1C1D',
  appPreviewBg: color.lightest,
  appBorderColor: 'rgba(255,255,255,.1)',
  appBorderRadius: 4,

  // Fonts
  fontBase: typography.fonts.base,
  fontCode: typography.fonts.mono,

  // Text colors
  textColor: '#C9CDCF',
  textInverseColor: '#222425',
  textMutedColor: '#798186',

  // Toolbar default and active colors
  barTextColor: color.mediumdark,
  barHoverColor: color.secondary,
  barSelectedColor: color.secondary,
  barBg: '#292C2E',

  // Form colors
  buttonBg: '#222425',
  buttonBorder: 'rgba(255,255,255,.1)',
  booleanBg: '#222425',
  booleanSelectedBg: '#2E3438',
  inputBg: '#1B1C1D',
  inputBorder: 'rgba(255,255,255,.1)',
  inputTextColor: color.lightest,
  inputBorderRadius: 4,
};

export default theme;
