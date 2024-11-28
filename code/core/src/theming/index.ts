/// <reference path="../typings.d.ts" />
/// <reference path="./emotionAugmentation.d.ts" />
import type { FunctionInterpolation, Interpolation } from '@emotion/react';

import type { StorybookTheme } from './types';

export { default as styled } from '@emotion/styled';

export type { StyledComponent } from '@emotion/styled';

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
export type { CSSObject, Keyframes } from '@emotion/react';

type FunctionInterpolationEnhanced<T = {}> = FunctionInterpolation<T & { theme: StorybookTheme }>;
type InterpolationEnhanced<T = {}> = Interpolation<T & { theme: StorybookTheme }>;
export type {
  FunctionInterpolationEnhanced as FunctionInterpolation,
  InterpolationEnhanced as Interpolation,
};

export * from './base';
export * from './types';
// export * from './emotionAugmentation.d.ts';

export { default as createCache } from '@emotion/cache';
export { default as isPropValid } from '@emotion/is-prop-valid';

export { createGlobal, createReset, createThemeVars } from './global';
export * from './create';
export * from './convert';
export * from './ensure';

export { lightenColor as lighten, darkenColor as darken } from './utils';

export const ignoreSsrWarning =
  '/* emotion-disable-server-rendering-unsafe-selector-warning-please-do-not-use-this-the-warning-exists-for-a-reason */';
