import type {
  API_FilterFunction,
  API_PreparedIndexEntry,
  StatusValue,
} from 'storybook/internal/types';

import { statusValueShortName, toStatusValue } from '../../shared/status-store/index.ts';
import { parseFilterParam } from '../lib/filter-param.ts';
import { fullStatusStore } from '../stores/status.ts';

export const parseStatusesParam = (
  statusesParam: string | undefined
): { included: StatusValue[]; excluded: StatusValue[] } =>
  parseFilterParam(statusesParam, toStatusValue);

export const serializeStatusesParam = (
  included: StatusValue[],
  excluded: StatusValue[]
): string | undefined => {
  if (!included.length && !excluded.length) {
    return undefined;
  }

  const serializedIncluded = included.map((v) => statusValueShortName(v)).sort();
  const serializedExcluded = excluded.map((v) => `!${statusValueShortName(v)}`).sort();

  return [...serializedIncluded, ...serializedExcluded].join(';');
};

export const computeStatusFilterFn = (
  includedStatusFilters: StatusValue[],
  excludedStatusFilters: StatusValue[]
): API_FilterFunction => {
  return (entry: API_PreparedIndexEntry) => {
    if (!includedStatusFilters.length && !excludedStatusFilters.length) {
      return true;
    }

    const allStatuses = fullStatusStore.getAll() ?? {};
    const storyStatuses = allStatuses[entry.id];
    const storyStatusValues = storyStatuses ? Object.values(storyStatuses).map((s) => s.value) : [];

    const passesInclude =
      !includedStatusFilters.length ||
      includedStatusFilters.some((v) => storyStatusValues.includes(v));

    const passesExclude =
      !excludedStatusFilters.length ||
      excludedStatusFilters.every((v) => !storyStatusValues.includes(v));

    return passesInclude && passesExclude;
  };
};
