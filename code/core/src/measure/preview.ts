import { definePreviewAddon } from 'storybook/internal/csf';

import { PARAM_KEY } from './constants';
import type { MeasureTypes } from './types';
import { withMeasure } from './withMeasure';

export const decorators = globalThis.FEATURES?.measure ? [withMeasure] : [];

export const initialGlobals = {
  [PARAM_KEY]: false,
};

export type { MeasureTypes };

export default () =>
  definePreviewAddon<MeasureTypes>({
    decorators,
    initialGlobals,
  });
