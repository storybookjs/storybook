import { definePreview } from 'storybook/internal/preview-api';

import * as addonAnnotations from './preview';

export default () => definePreview(addonAnnotations);

export type { BackgroundsParameters, BackgroundsGlobals } from './types';
