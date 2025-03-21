import { definePreview } from 'storybook/preview-api';

import * as addonAnnotations from './preview';

export * from './defaults';
export type * from './types';

export default () => definePreview(addonAnnotations);
