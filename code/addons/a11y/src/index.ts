import * as addonAnnotations from '@storybook/addon-a11y/preview';

import { definePreview } from 'storybook/preview-api';

export { PARAM_KEY } from './constants';
export * from './params';
export type { A11yParameters } from './types';

export default () => definePreview(addonAnnotations);
