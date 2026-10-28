import type { animation, easing } from './animation.ts';
import type { background, color, tokens, typography } from './base.ts';

export type {
  ThemeVars,
  ThemeVarsColors,
  ThemeVarsPartial,
} from '@storybook/core/internal/deep/types/modules/theming';

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

  fgColor: typeof tokens.light.fgColor;
  bgColor: typeof tokens.light.bgColor;
  borderColor: typeof tokens.light.borderColor;

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
