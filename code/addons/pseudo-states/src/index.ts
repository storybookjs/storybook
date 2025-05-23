import { definePreviewAddon } from 'storybook/internal/csf';

import * as addonAnnotations from './preview';

export { PARAM_KEY } from './constants';

export default () => definePreviewAddon(addonAnnotations);
