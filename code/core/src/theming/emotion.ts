import type { FunctionInterpolation, Interpolation } from '@emotion/react';

import type { StorybookTheme } from './types.ts';

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

export * from './base.ts';
export * from './types.ts';

export { default as createCache } from '@emotion/cache';
export { default as isPropValid } from '@emotion/is-prop-valid';

export { createGlobal, createReset, srOnlyStyles, srOnlyUnsetStyles } from './global.ts';
export { create, themes } from './create.ts';
export * from './convert.ts';
export * from './ensure.ts';

export {
  lightenColor as lighten,
  darkenColor as darken,
  getPreferredColorScheme,
} from './utils.ts';

export const ignoreSsrWarning =
  '/* emotion-disable-server-rendering-unsafe-selector-warning-please-do-not-use-this-the-warning-exists-for-a-reason */';

// `'.'` does not name this package entry once the file is resolved as
// `storybook/theming/emotion`, so the merge would miss the exported Theme.
declare module 'storybook/theming/emotion' {
  interface Theme extends StorybookTheme {}
}
export type { Theme } from '@emotion/react';
