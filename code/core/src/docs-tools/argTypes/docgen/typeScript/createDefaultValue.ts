import { createSummaryValue } from '../../utils.ts';
import type { PropDefaultValue } from '../PropDef.ts';
import type { DocgenInfo } from '../types.ts';
import { isDefaultValueBlacklisted } from '../utils/defaultValue.ts';

export function createDefaultValue({ defaultValue }: DocgenInfo): PropDefaultValue | null {
  if (defaultValue != null) {
    const { value } = defaultValue;

    if (!isDefaultValueBlacklisted(value)) {
      return createSummaryValue(value);
    }
  }

  return null;
}
