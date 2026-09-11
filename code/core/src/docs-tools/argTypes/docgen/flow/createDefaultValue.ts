import { createSummaryValue, isTooLongForDefaultValueSummary } from '../../utils.ts';
import type { PropDefaultValue } from '../PropDef.ts';
import type { DocgenPropDefaultValue, DocgenPropType } from '../types.ts';
import { isDefaultValueBlacklisted } from '../utils/defaultValue.ts';

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
