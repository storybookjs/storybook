import type { ArgTypes, StrictArgTypes } from '@storybook/csf';

import { combineParameters } from './parameters';

export const combineArgTypes = (
  projectArgTypes: Partial<ArgTypes> | StrictArgTypes | undefined,
  componentArgTypes: Partial<ArgTypes> | StrictArgTypes | undefined,
  storyArgTypes: Partial<ArgTypes> | StrictArgTypes | undefined
): StrictArgTypes => {
  const combinedArgTypes = combineParameters(projectArgTypes, componentArgTypes, storyArgTypes);
  return Object.fromEntries(
    Object.entries(combinedArgTypes).map(([key, argType]) => {
      const componentArgType: any = componentArgTypes?.[key];
      const storyArgType: any = storyArgTypes?.[key];
      if (
        argType?.control?.disable &&
        componentArgType?.control?.disable &&
        storyArgType?.control?.type &&
        !storyArgType?.control?.disable
      ) {
        delete argType.control.disable;
      }
      return [key, argType];
    })
  );
};
