import React, { useMemo } from 'react';

import { Button } from 'storybook/internal/components';
import type { StatusesByStoryIdAndTypeId, StatusValue } from 'storybook/internal/types';

import { type API, type Combo, Consumer, experimental_useStatusStore } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { countStatusesByValue } from './FilterPanel.utils.ts';
import { UseSymbol } from './IconSymbols.tsx';

const StyledCTA = styled(Button)<{ $isActive: boolean }>(({ $isActive, theme }) => ({
  marginTop: -8,
  width: '100%',
  justifyContent: 'flex-start',
  '&:focus-visible': { outlineOffset: 4 },
  ...($isActive && {
    background: theme.background.hoverable,
    color: theme.color.secondary,
  }),
}));

const StyledIcon = styled.svg(({ theme }) => ({
  color: theme.fgColor.accent,
}));

const NEW = 'status-value:new' as StatusValue;
const MOD = 'status-value:modified' as StatusValue;

const filterMapper = ({ api, state }: Combo) => ({
  api,
  includedStatusFilters: (state.includedStatusFilters ?? []) as StatusValue[],
  excludedStatusFilters: (state.excludedStatusFilters ?? []) as StatusValue[],
});

interface ReviewChangesButtonInnerProps {
  api: API;
  includedStatusFilters: StatusValue[];
  excludedStatusFilters: StatusValue[];
}

const ReviewChangesButtonInner = ({
  api,
  includedStatusFilters,
  excludedStatusFilters,
}: ReviewChangesButtonInnerProps) => {
  const allStatuses = experimental_useStatusStore() as StatusesByStoryIdAndTypeId;

  const counts = useMemo(() => countStatusesByValue(allStatuses), [allStatuses]);
  const newCount = counts[NEW] ?? 0;
  const modifiedCount = counts[MOD] ?? 0;

  const isReviewActive = includedStatusFilters.includes(NEW) && includedStatusFilters.includes(MOD);

  if (!globalThis.FEATURES?.changeDetection) {
    return null;
  }

  if (newCount === 0 && modifiedCount === 0) {
    return null;
  }

  const onClick = () => {
    if (isReviewActive) {
      const nextIncluded = includedStatusFilters.filter((s) => s !== NEW && s !== MOD);
      api.setAllStatusFilters(nextIncluded, excludedStatusFilters);
    } else {
      const nextIncluded = Array.from(new Set([...includedStatusFilters, NEW, MOD]));
      const nextExcluded = excludedStatusFilters.filter((s) => s !== NEW && s !== MOD);
      api.setAllStatusFilters(nextIncluded, nextExcluded);
    }
  };

  const verb = isReviewActive ? 'Reviewing' : 'Review';

  return (
    <StyledCTA
      variant="ghost"
      padding="small"
      $isActive={isReviewActive}
      aria-pressed={isReviewActive}
      aria-label={`${verb} ${newCount} new and ${modifiedCount} changed stories`}
      onClick={onClick}
    >
      <StyledIcon viewBox="0 0 14 14" width="14" height="14" aria-hidden>
        <UseSymbol type="new" />
      </StyledIcon>
      {`${verb} ${newCount} new, ${modifiedCount} changed`}
    </StyledCTA>
  );
};

const ReviewChangesButton = () => (
  <Consumer filter={filterMapper}>
    {({ api, includedStatusFilters, excludedStatusFilters }) => (
      <ReviewChangesButtonInner
        api={api}
        includedStatusFilters={includedStatusFilters}
        excludedStatusFilters={excludedStatusFilters}
      />
    )}
  </Consumer>
);

export default ReviewChangesButton;
