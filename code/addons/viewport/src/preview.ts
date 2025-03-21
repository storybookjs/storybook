import { PARAM_KEY as KEY } from './constants';
import type { GlobalState } from './types';

export const initialGlobals: Record<string, GlobalState> = {
  [KEY]: { value: undefined, isRotated: false },
};
