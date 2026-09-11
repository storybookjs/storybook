import { definePreviewAddon } from 'storybook/internal/csf';

import * as addonAnnotations from './preview.ts';

export { linkTo, hrefTo, withLinks, navigate } from './utils.ts';

export default () => definePreviewAddon(addonAnnotations);
