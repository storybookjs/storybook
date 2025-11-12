import { color, tokens, typography } from '../base';
import type { ThemeVars } from '../types';

const { fgColor, bgColor, borderColor } = tokens.dark;

const theme: ThemeVars = {
  base: 'dark',

  // Storybook-specific color palette
  colorPrimary: '#FF4785', // coral
  colorSecondary: fgColor.accent,

  // UI
  appBg: bgColor.muted,
  appContentBg: bgColor.default,
  appHoverBg: '#70B3FF'.
  appPreviewBg: color.lightest,
  appBorderColor: borderColor.default,
  appBorderRadius: 4,

  // Fonts
  fontBase: typography.fonts.base,
  fontCode: typography.fonts.mono,

  // Text colors
  textColor: fgColor.default,
  textInverseColor: fgColor.inverse,
  textMutedColor: fgColor.muted,

  // Toolbar default and active colors
  barTextColor: fgColor.muted,
  barHoverColor: '#70B3FF',
  barSelectedColor: '#479DFF',
  barBg: bgColor.default,

  // Form colors
  buttonBg: bgColor.muted,
  buttonBorder: borderColor.default,
  booleanBg: bgColor.muted,
  booleanSelectedBg: '#292B2E',
  inputBg: bgColor.muted,
  inputBorder: borderColor.default,
  inputTextColor: fgColor.default,
  inputBorderRadius: 4,
};

export default theme;
