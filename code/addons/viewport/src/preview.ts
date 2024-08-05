import { PARAM_KEY as KEY } from './constants';
import type { GlobalState } from './types';

const modern: Record<string, GlobalState> = {
  [KEY]: { value: undefined, isRotated: false },
};

// TODO: remove in 9.0
const legacy = { viewport: 'reset', viewportRotated: false };

export const initialGlobals = FEATURES?.viewportStoryGlobals ? modern : legacy;
