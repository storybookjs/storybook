import type { PropDefFactory } from '../createPropDef.ts';
import { createDefaultValue } from './createDefaultValue.ts';
import { createType } from './createType.ts';

export const createTsPropDef: PropDefFactory = (propName, docgenInfo) => {
  const { description, required } = docgenInfo;

  return {
    name: propName,
    type: createType(docgenInfo),
    required,
    description,
    defaultValue: createDefaultValue(docgenInfo),
  };
};
