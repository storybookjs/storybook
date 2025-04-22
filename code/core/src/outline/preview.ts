import { definePreview } from 'storybook/preview-api';

import { PARAM_KEY } from './constants';
import { withOutline } from './withOutline';

export const decorators = globalThis.FEATURES?.outline ? [withOutline] : [];

export const initialGlobals = {
  [PARAM_KEY]: false,
};

export default () => definePreview({ decorators, initialGlobals });
