import type { PropDefaultValue } from '../PropDef';
import type { DocgenPropDefaultValue, DocgenPropType } from '../types';

import { createSummaryValue, isTooLongForDefaultValueSummary } from '../../utils';
import { isDefaultValueBlacklisted } from '../utils/defaultValue';

export function createDefaultValue(
  defaultValue: DocgenPropDefaultValue | null,
  type: DocgenPropType | null
): PropDefaultValue | null {
  if (defaultValue != null) {
    const { value } = defaultValue;

    if (!isDefaultValueBlacklisted(value)) {
      return !isTooLongForDefaultValueSummary(value)
        ? createSummaryValue(value)
        : createSummaryValue(type?.name, value);
    }
  }

  return null;
}
