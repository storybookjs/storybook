import type { API } from 'storybook/manager-api';
import type { StatusValue } from 'storybook/internal/types';

import { REVIEWING_STATUS_VALUE } from './review-status.ts';

export async function setReviewStatusFilters(
  api: API,
  included: StatusValue[],
  excluded: StatusValue[]
): Promise<void> {
  if (typeof api.setAllStatusFilters === 'function') {
    await api.setAllStatusFilters(included, excluded);
    return;
  }

  if (typeof api.resetStatusFilters === 'function') {
    await api.resetStatusFilters();
  }

  if (included.length > 0 && typeof api.addStatusFilters === 'function') {
    await api.addStatusFilters(included, false);
  }

  if (excluded.length > 0 && typeof api.addStatusFilters === 'function') {
    await api.addStatusFilters(excluded, true);
  }
}

export async function clearReviewingStatusFilter(
  api: API,
  includedStatusFilters: StatusValue[],
  excludedStatusFilters: StatusValue[]
): Promise<void> {
  const nextIncluded = includedStatusFilters.filter((value) => value !== REVIEWING_STATUS_VALUE);
  const nextExcluded = excludedStatusFilters.filter((value) => value !== REVIEWING_STATUS_VALUE);
  if (
    nextIncluded.length === includedStatusFilters.length &&
    nextExcluded.length === excludedStatusFilters.length
  ) {
    return;
  }
  await setReviewStatusFilters(api, nextIncluded, nextExcluded);
}
