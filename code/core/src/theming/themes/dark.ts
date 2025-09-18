import { color, typography } from '../base';
import type { ThemeVars } from '../types';

const theme: ThemeVars = {
  base: 'dark',

  // Storybook-specific color palette
  colorPrimary: '#FF4785', // coral
  colorSecondary: '#479DFF',

  // UI
  appBg: '#1B1C1D',
  appContentBg: '#222325',
  appPreviewBg: color.lightest,
  appBorderColor: 'rgba(255,255,255,.1)',
  appBorderRadius: 4,

  // Fonts
  fontBase: typography.fonts.base,
  fontCode: typography.fonts.mono,

  // Text colors
  textColor: '#C9CCCF',
  textInverseColor: '#1B1C1D',
  textMutedColor: '#95999D',

  // Toolbar default and active colors
  barTextColor: '#95999D',
  barHoverColor: '#70B3FF',
  barSelectedColor: '#479DFF',
  barBg: '#222325',

  // Form colors
  buttonBg: '#222425',
  buttonBorder: 'rgba(255,255,255,.1)',
  booleanBg: '#1B1C1D',
  booleanSelectedBg: '#292B2E',
  inputBg: '#1B1C1D',
  inputBorder: 'rgba(255,255,255,.1)',
  inputTextColor: '#C9CCCF',
  inputBorderRadius: 4,
};

export default theme;
