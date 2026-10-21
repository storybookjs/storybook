/// <reference path="../typings.d.ts" />

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

export type { StorybookTheme as Theme } from './types.ts';
