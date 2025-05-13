import type { PropDefFactory } from '../createPropDef';
import { createDefaultValue } from './createDefaultValue';
import { createType } from './createType';

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
