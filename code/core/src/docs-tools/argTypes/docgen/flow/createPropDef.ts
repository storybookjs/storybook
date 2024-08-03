import type { PropDefFactory } from '../createPropDef';

import { createType } from './createType';

import { createDefaultValue } from './createDefaultValue';

export const createFlowPropDef: PropDefFactory = (propName, docgenInfo) => {
  const { flowType, description, required, defaultValue } = docgenInfo;

  return {
    name: propName,
    type: createType(flowType),
    required,
    description,
    defaultValue: createDefaultValue(defaultValue ?? null, flowType ?? null),
  };
};
