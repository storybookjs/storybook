import { createSummaryValue } from '../../utils';
import type { PropType } from '../PropDef';
import type { DocgenInfo } from '../types';

export function createType({ tsType, required }: DocgenInfo): PropType | null {
  // A type could be null if a defaultProp has been provided without a type definition.
  if (tsType == null) {
    return null;
  }

  let typeName = tsType.name;
  if (!required) {
    typeName = typeName.replace(' | undefined', '');
  }

  return createSummaryValue(
    ['Array', 'Record', 'signature'].includes(tsType.name) ? tsType.raw : typeName
  );
}
