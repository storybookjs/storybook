import type { ActionOptions } from '../models';

export const config: ActionOptions = {
  depth: 10,
  clearOnStoryChange: true,
  limit: 50,
};

export const configureActions = (options: ActionOptions = {}): void => {
  Object.assign(config, options);
};
