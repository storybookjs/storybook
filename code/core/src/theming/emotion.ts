import type { FunctionInterpolation, Interpolation } from '@emotion/react';

import type { StorybookTheme } from './types.ts';

export type { StyledComponent } from '@emotion/styled';
export type { CSSObject, Keyframes } from '@emotion/react';

type FunctionInterpolationEnhanced<T = {}> = FunctionInterpolation<T & { theme: StorybookTheme }>;
type InterpolationEnhanced<T = {}> = Interpolation<T & { theme: StorybookTheme }>;
export type {
  FunctionInterpolationEnhanced as FunctionInterpolation,
  InterpolationEnhanced as Interpolation,
};

export {
  background,
  color,
  create,
  createGlobal,
  createReset,
  darken,
  getPreferredColorScheme,
  ignoreSsrWarning,
  lighten,
  srOnlyStyles,
  srOnlyUnsetStyles,
  themes,
  tokens,
  typography,
} from './index.ts';
export type {
  Animation,
  Background,
  Brand,
  Color,
  Easing,
  StorybookTheme,
  TextSize,
  ThemeVars,
  ThemeVarsColors,
  ThemeVarsPartial,
  Typography,
} from './index.ts';
export * from './convert.ts';
export * from './ensure.ts';

export { default as styled } from '@emotion/styled';
export {
  CacheProvider,
  ClassNames,
  css,
  Global,
  jsx,
  keyframes,
  ThemeProvider,
  useTheme,
  withTheme,
} from '@emotion/react';
export { default as createCache } from '@emotion/cache';
export { default as isPropValid } from '@emotion/is-prop-valid';

// styled and useTheme read Theme from @emotion/react, not from this module's export.
// Do not augment this module: storybook/theming's Theme is an alias of StorybookTheme,
// and a self-augmentation would make that alias extend itself.
declare module '@emotion/react' {
  export interface Theme extends StorybookTheme {}
}
export type { Theme } from '@emotion/react';
