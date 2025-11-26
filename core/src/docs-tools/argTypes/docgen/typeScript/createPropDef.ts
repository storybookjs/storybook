import type { PropDefFactory } from '../createPropDef';
import { createDefaultValue } from './createDefaultValue';
import { createType } from './createType';

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
