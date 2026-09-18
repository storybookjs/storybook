import { definePreviewAddon } from 'storybook/internal/csf';

import * as addonAnnotations from './preview.ts';
import type { PseudoTypes } from './types.ts';

export { PARAM_KEY } from './constants.ts';

export type { PseudoTypes } from './types.ts';

export default () => definePreviewAddon<PseudoTypes>(addonAnnotations);
