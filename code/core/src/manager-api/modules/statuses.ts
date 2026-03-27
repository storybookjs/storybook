import type {
  API_FilterFunction,
  API_PreparedIndexEntry,
  StatusValue,
} from 'storybook/internal/types';

import { statusValueShortName, toStatusValue } from '../../shared/status-store';
import { fullStatusStore } from '../stores/status';

export const parseStatusesParam = (
  statusesParam: string | undefined
): { included: StatusValue[]; excluded: StatusValue[] } => {
  if (!statusesParam) {
    return { included: [], excluded: [] };
  }

  const included: StatusValue[] = [];
  const excluded: StatusValue[] = [];

  statusesParam.split(';').forEach((rawStatus) => {
    if (!rawStatus) {
      return;
    }

    const isExcluded = rawStatus.startsWith('!');
    const shortName = isExcluded ? rawStatus.slice(1) : rawStatus;
    const statusValue = toStatusValue(shortName);

    if (!statusValue) {
      return; // silently ignore unknown short names
    }

    if (isExcluded) {
      excluded.push(statusValue);
    } else {
      included.push(statusValue);
    }
  });

  return { included, excluded };
};

export const serializeStatusesParam = (
  included: StatusValue[],
  excluded: StatusValue[]
): string | undefined => {
  if (!included.length && !excluded.length) {
    return undefined;
  }

  const serializedIncluded = included.map((v) => statusValueShortName(v));
  const serializedExcluded = excluded.map((v) => `!${statusValueShortName(v)}`);

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
