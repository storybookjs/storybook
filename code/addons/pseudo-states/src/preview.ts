import { PARAM_KEY } from './constants.ts';
import { withPseudoState } from './preview/withPseudoState.ts';

export const decorators = [withPseudoState];

export const initialGlobals = {
  [PARAM_KEY]: false,
};
