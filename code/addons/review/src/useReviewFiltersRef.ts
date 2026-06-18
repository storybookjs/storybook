import { type MutableRefObject, useRef } from 'react';

import { type ReviewModeFilters, useStorybookState } from 'storybook/manager-api';
import type { StatusValue } from 'storybook/internal/types';

/**
 * Keep the current sidebar filters in a ref so click/shortcut handlers can read
 * them without re-binding. enterReviewMode snapshots these and they're restored
 * on exit; the ref is updated on every render to stay in sync with the store.
 */
export const useReviewFiltersRef = (): MutableRefObject<ReviewModeFilters> => {
  const { includedStatusFilters, excludedStatusFilters, includedTagFilters, excludedTagFilters } =
    useStorybookState();

  const filtersRef = useRef<ReviewModeFilters>({
    includedStatusFilters: [],
    excludedStatusFilters: [],
    includedTagFilters: [],
    excludedTagFilters: [],
  });
  filtersRef.current = {
    includedStatusFilters: (includedStatusFilters ?? []) as StatusValue[],
    excludedStatusFilters: (excludedStatusFilters ?? []) as StatusValue[],
    includedTagFilters: includedTagFilters ?? [],
    excludedTagFilters: excludedTagFilters ?? [],
  };
  return filtersRef;
};
