import { definePreview } from 'storybook/preview-api';

import * as addonAnnotations from './preview';

export { PARAM_KEY } from './constants';

export default () => definePreview(addonAnnotations);
