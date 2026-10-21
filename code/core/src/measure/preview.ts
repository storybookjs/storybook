import { definePreviewAddon } from 'storybook/internal/csf';

import { applyMeasure, drawAtPointer } from './applyMeasure.ts';
import { PARAM_KEY } from './constants.ts';
import type { MeasureTypes } from './types.ts';

const beforeEach = globalThis.FEATURES?.measure ? [applyMeasure] : [];
const afterEach = globalThis.FEATURES?.measure ? [drawAtPointer] : [];

export const initialGlobals = {
  [PARAM_KEY]: false,
};

export type { MeasureTypes };

export default () =>
  definePreviewAddon<MeasureTypes>({
    beforeEach,
    afterEach,
    initialGlobals,
  });
