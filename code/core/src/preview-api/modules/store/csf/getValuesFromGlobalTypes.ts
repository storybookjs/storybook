import type { GlobalTypes, Globals } from 'storybook/internal/types';

export const getValuesFromGlobalTypes = (argTypes: GlobalTypes = {}): Globals =>
  Object.entries(argTypes).reduce<Globals>((acc, [arg, { defaultValue }]) => {
    if (typeof defaultValue !== 'undefined') {
      acc[arg] = defaultValue;
    }
    return acc;
  }, {});
