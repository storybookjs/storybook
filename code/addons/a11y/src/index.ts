import { definePreview } from 'storybook/internal/preview-api';

import * as addonAnnotations from './preview';

export { PARAM_KEY } from './constants';
export * from './params';
export type { A11yParameters } from './types';

export default () => definePreview(addonAnnotations);
