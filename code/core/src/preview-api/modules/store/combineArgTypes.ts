import type { ArgTypes, StrictArgTypes } from '@storybook/csf';

import { combineParameters } from './parameters';

export const combineArgTypes = (
  ...argTypes: (Partial<ArgTypes> | StrictArgTypes | undefined)[]
): StrictArgTypes => {
  const combinedArgTypes = combineParameters(...argTypes);
  return Object.fromEntries(
    Object.entries(combinedArgTypes).map(([key, argType]) => {
      if (argType.control?.type && argType.control?.disable) {
        delete argType.control.disable;
      }
      return [key, argType];
    })
  );
};
