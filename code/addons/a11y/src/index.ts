import { definePreviewAddon } from 'storybook/internal/csf';

import * as addonAnnotations from './preview.tsx';
import type { A11yTypes } from './types.ts';

export { PARAM_KEY } from './constants.ts';
export * from './params.ts';
export type { A11yGlobals, A11yTypes, A11yReport } from './types.ts';

export default () => definePreviewAddon<A11yTypes>(addonAnnotations);
