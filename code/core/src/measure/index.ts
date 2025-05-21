import { definePreview } from 'storybook/preview-api';

import * as addonAnnotations from './preview';

export type { MeasureParameters } from './types';

export default () => definePreview(addonAnnotations);
