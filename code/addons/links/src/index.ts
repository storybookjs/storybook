import { definePreview } from 'storybook/preview-api';

import * as addonAnnotations from './preview';

export { linkTo, hrefTo, withLinks, navigate } from './utils';

export default () => definePreview(addonAnnotations);
