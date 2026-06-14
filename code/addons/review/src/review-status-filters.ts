import type { API } from 'storybook/manager-api';
import type { StatusValue } from 'storybook/internal/types';

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
