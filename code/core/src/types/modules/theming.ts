export interface ThemeVars extends ThemeVarsBase, ThemeVarsColors {}

export interface ThemeVarsPartial extends ThemeVarsBase, Partial<ThemeVarsColors> {}

interface ThemeVarsBase {
  base: 'light' | 'dark';
}

export interface ThemeVarsColors {
  colorPrimary: string;
  colorSecondary: string;

  // UI
  appBg: string;
  appContentBg: string;
  appHoverBg: string;
  appPreviewBg: string;
  appBorderColor: string;
  appBorderRadius: number;

  // Typography
  fontBase: string;
  fontCode: string;

  // Text colors
  textColor: string;
  textInverseColor: string;
  textMutedColor: string;

  // Toolbar default and active colors
  barTextColor: string;
  barHoverColor: string;
  barSelectedColor: string;
  barBg: string;

  // Form colors
  buttonBg: string;
  buttonBorder: string;
  booleanBg: string;
  booleanSelectedBg: string;
  inputBg: string;
  inputBorder: string;
  inputTextColor: string;
  inputBorderRadius: number;

  brandTitle?: string;
  brandUrl?: string;
  brandImage?: string;
  brandTarget?: string;

  gridCellSize?: number;
}
