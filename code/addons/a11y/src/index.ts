import { definePreviewAddon } from 'storybook/internal/csf';

import * as addonAnnotations from './preview';
import type { A11yTypes } from './types';

export { PARAM_KEY } from './constants';
export * from './params';
export type { A11yTypes } from './types';

export default () => definePreviewAddon<A11yTypes>(addonAnnotations);
