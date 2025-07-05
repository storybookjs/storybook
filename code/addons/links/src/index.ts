import { definePreviewAddon } from 'storybook/internal/csf';

import * as addonAnnotations from './preview';

export { linkTo, hrefTo, withLinks, navigate } from './utils';

export default () => definePreviewAddon(addonAnnotations);
