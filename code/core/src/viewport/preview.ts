import { PARAM_KEY } from './constants';
import type { GlobalState } from './types';

export const initialGlobals: Record<string, GlobalState> = {
  [PARAM_KEY]: { value: undefined, isRotated: false },
};
