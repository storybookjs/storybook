import { definePreview } from 'storybook/preview-api';

import addonAnnotations from './preview';

export default () => definePreview(addonAnnotations);
