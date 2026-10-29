import { definePreviewAddon } from 'storybook/internal/csf';

import { getFeatures } from '@storybook/core/preview-api';

import { PARAM_KEY } from './constants.ts';
import type { MeasureTypes } from './types.ts';
import { withMeasure } from './withMeasure.ts';

export const decorators = getFeatures().measure ? [withMeasure] : [];

export const initialGlobals = {
  [PARAM_KEY]: false,
};

export type { MeasureTypes };

export default definePreviewAddon<MeasureTypes>({
  decorators,
  initialGlobals,
});
