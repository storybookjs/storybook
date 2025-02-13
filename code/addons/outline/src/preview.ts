import { PARAM_KEY } from './constants';
import { withOutline } from './withOutline';

export const decorators = [withOutline];

export const initialGlobals = {
  [PARAM_KEY]: false,
};
