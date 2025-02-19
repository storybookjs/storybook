import { definePreview } from 'storybook/internal/preview-api';

import addonAnnotations from './preview';

export default () => definePreview(addonAnnotations);
