import type { GlobalTypes, Globals } from 'storybook/internal/types';

export const getValuesFromGlobalTypes = (globalTypes: GlobalTypes = {}): Globals =>
  Object.entries(globalTypes).reduce<Globals>((acc, [arg, { defaultValue }]) => {
    if (typeof defaultValue !== 'undefined') {
      acc[arg] = defaultValue;
    }
    return acc;
  }, {});
