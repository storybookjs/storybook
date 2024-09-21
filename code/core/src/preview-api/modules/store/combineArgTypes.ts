import type { ArgTypes, StrictArgTypes } from '@storybook/csf';

import { combineParameters } from './parameters';

export const combineArgTypes = (
  ...argTypes: (Partial<ArgTypes> | StrictArgTypes | undefined)[]
): StrictArgTypes => {
  const combinedArgTypes = combineParameters(...argTypes);
  return Object.entries(combinedArgTypes).reduce((acc, [key, argType]) => {
    if (argType.control?.type && argType.control?.disable) {
      delete argType.control.disable;
    }
    acc[key] = argType;
    return acc;
  }, {} as StrictArgTypes);
};
