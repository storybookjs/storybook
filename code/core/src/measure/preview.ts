import { definePreview } from '../preview-api/modules/addons/definePreview';
import { PARAM_KEY } from './constants';
import { withMeasure } from './withMeasure';

export const decorators = globalThis.FEATURES?.measure ? [withMeasure] : [];

export const initialGlobals = {
  [PARAM_KEY]: false,
};

export default () =>
  definePreview({
    decorators,
    initialGlobals,
  });
