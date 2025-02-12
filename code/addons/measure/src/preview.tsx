import { PARAM_KEY } from './constants';
import { withMeasure } from './withMeasure';

export const decorators = [withMeasure];

export const initialGlobals = {
  [PARAM_KEY]: false,
};
