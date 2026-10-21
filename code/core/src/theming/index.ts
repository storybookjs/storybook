/// <reference path="../typings.d.ts" />
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

export * from './base.ts';
export * from './types.ts';
export * from './create.ts';
export { createGlobal, createReset, srOnlyStyles, srOnlyUnsetStyles } from './global.ts';
export {
  lightenColor as lighten,
  darkenColor as darken,
  getPreferredColorScheme,
} from './utils.ts';

export const ignoreSsrWarning =
  '/* emotion-disable-server-rendering-unsafe-selector-warning-please-do-not-use-this-the-warning-exists-for-a-reason */';

// Re-export Theme from @emotion/react and self-augment with StorybookTheme
declare module '.' {
  interface Theme extends StorybookTheme {}
}
export type { Theme } from '@emotion/react';
