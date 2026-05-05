interface ActiveFiltersInput {
  includedTagFilters?: readonly unknown[];
  excludedTagFilters?: readonly unknown[];
  includedStatusFilters?: readonly unknown[];
  excludedStatusFilters?: readonly unknown[];
}

export const getActiveFilterCount = ({
  includedTagFilters,
  excludedTagFilters,
  includedStatusFilters,
  excludedStatusFilters,
}: ActiveFiltersInput): number =>
  (includedTagFilters?.length ?? 0) +
  (excludedTagFilters?.length ?? 0) +
  (includedStatusFilters?.length ?? 0) +
  (excludedStatusFilters?.length ?? 0);

export const hasActiveFilters = (filters: ActiveFiltersInput): boolean =>
  getActiveFilterCount(filters) > 0;
