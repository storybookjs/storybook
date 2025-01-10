import type { animation, easing } from './animation';
import type { background, color, typography } from './base';

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

export type Color = typeof color;
export type Background = typeof background;
export type Typography = typeof typography;
export type Animation = typeof animation;
export type Easing = typeof easing;

export type TextSize = number | string;
export interface Brand {
  title: string | undefined;
  url: string | null | undefined;
  image: string | null | undefined;
  target: string | null | undefined;
}

export interface StorybookTheme {
  color: Color;
  background: Background;
  typography: Typography;
  animation: Animation;
  easing: Easing;

  input: {
    border: string;
    background: string;
    color: string;
    borderRadius: number;
  };

  // UI
  layoutMargin: number;
  appBorderColor: string;
  appBorderRadius: number;

  // Toolbar default/active colors
  barTextColor: string;
  barHoverColor: string;
  barSelectedColor: string;
  barBg: string;

  brand: Brand;

  code: {
    [key: string]: string | object;
  };

  [key: string]: any;
}
