import { createSummaryValue } from '../../utils';
import type { PropDefaultValue } from '../PropDef';
import type { DocgenInfo } from '../types';
import { isDefaultValueBlacklisted } from '../utils/defaultValue';

export function createDefaultValue({ defaultValue }: DocgenInfo): PropDefaultValue | null {
  if (defaultValue != null) {
    const { value } = defaultValue;

    if (!isDefaultValueBlacklisted(value)) {
      return createSummaryValue(value);
    }
  }

  return null;
}
