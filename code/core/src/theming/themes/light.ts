import { background, color, tokens, typography } from '../base';
import type { ThemeVars } from '../types';

const { fgColor, bgColor, borderColor } = tokens.light;

const theme: ThemeVars = {
  base: 'light',

  // Storybook-specific color palette
  colorPrimary: color.primary,
  colorSecondary: fgColor.accent,

  // UI
  appBg: bgColor.muted,
  appContentBg: bgColor.default,
  appHoverBg: '#DBECFF',
  appPreviewBg: bgColor.default,
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
  barHoverColor: '#005CC7',
  barSelectedColor: '#0063D6',
  barBg: bgColor.default,

  // Form colors
  buttonBg: bgColor.muted,
  buttonBorder: color.medium,
  booleanBg: color.mediumlight,
  booleanSelectedBg: bgColor.default,
  inputBg: bgColor.default,
  inputBorder: borderColor.default,
  inputTextColor: fgColor.default,
  inputBorderRadius: 4,
};

export default theme;
