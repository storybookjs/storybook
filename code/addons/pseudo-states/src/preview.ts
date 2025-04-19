import { PARAM_KEY } from './constants';
import { withPseudoState } from './preview/withPseudoState';

export const decorators = [withPseudoState];

export const initialGlobals = {
  [PARAM_KEY]: false,
};
