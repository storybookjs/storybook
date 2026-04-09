import type { StoreState } from '../types.ts';

let currentRunConfig: StoreState['config'] = {
  coverage: false,
  a11y: false,
};

export const setCurrentRunConfig = (config: StoreState['config']) => {
  currentRunConfig = config;
};

export const getCurrentRunConfig = (): StoreState['config'] => currentRunConfig;
