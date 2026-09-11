import type { PropDefFactory } from '../createPropDef.ts';
import { createDefaultValue } from './createDefaultValue.ts';
import { createType } from './createType.ts';

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
