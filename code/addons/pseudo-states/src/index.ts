import { definePreviewAddon } from 'storybook/internal/csf';

import * as addonAnnotations from './preview';
import type { PseudoTypes } from './types';

export { PARAM_KEY } from './constants';

export type { PseudoTypes } from './types';

export default () => definePreviewAddon<PseudoTypes>(addonAnnotations);
