import { definePreviewAddon } from 'storybook/internal/csf';

import * as addonAnnotations from './preview';

export default () => definePreviewAddon(addonAnnotations);
