import { definePreview } from 'storybook/preview-api';

import * as addonAnnotations from './preview';

export default () => definePreview(addonAnnotations);

export type { TestParameters } from './types';
