import React, { useMemo } from 'react';

import { Button } from 'storybook/internal/components';
import type {
  API_PreparedIndexEntry,
  StatusesByStoryIdAndTypeId,
  StatusValue,
  StoryIndex,
  Tag,
} from 'storybook/internal/types';

import { type API, type Combo, Consumer, experimental_useStatusStore } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { computeStatusFilterFn } from '../../../manager-api/modules/statuses.ts';
import { computeTagsFilterFn } from '../../../manager-api/modules/tags.ts';
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
  index: state.internal_index as StoryIndex | undefined,
  includedTagFilters: (state.includedTagFilters ?? []) as Tag[],
  excludedTagFilters: (state.excludedTagFilters ?? []) as Tag[],
  includedStatusFilters: (state.includedStatusFilters ?? []) as StatusValue[],
  excludedStatusFilters: (state.excludedStatusFilters ?? []) as StatusValue[],
});

interface ReviewChangesButtonInnerProps {
  api: API;
  index: StoryIndex | undefined;
  includedTagFilters: Tag[];
  excludedTagFilters: Tag[];
  includedStatusFilters: StatusValue[];
  excludedStatusFilters: StatusValue[];
}

const ReviewChangesButtonInner = ({
  api,
  index,
  includedTagFilters,
  excludedTagFilters,
  includedStatusFilters,
  excludedStatusFilters,
}: ReviewChangesButtonInnerProps) => {
  const allStatuses = experimental_useStatusStore() as StatusesByStoryIdAndTypeId;

  const { newCount, modifiedCount } = useMemo(() => {
    if (!index) {
      return { newCount: 0, modifiedCount: 0 };
    }
    const contextualIncludedStatuses = includedStatusFilters.filter((s) => s !== NEW && s !== MOD);
    const contextualExcludedStatuses = excludedStatusFilters.filter((s) => s !== NEW && s !== MOD);
    const tagFilterFn = computeTagsFilterFn(includedTagFilters, excludedTagFilters);
    const statusFilterFn = computeStatusFilterFn(
      contextualIncludedStatuses,
      contextualExcludedStatuses
    );

    let next = 0;
    let modified = 0;
    const entries = index.entries ?? {};
    for (const [storyId, statusesByType] of Object.entries(allStatuses)) {
      const entry = entries[storyId] as API_PreparedIndexEntry | undefined;
      if (!entry) {
        continue;
      }
      const entryWithStatuses = { ...entry, statuses: statusesByType };
      if (!tagFilterFn(entryWithStatuses) || !statusFilterFn(entryWithStatuses)) {
        continue;
      }
      const values = Object.values(statusesByType).map((s) => s.value);
      if (values.includes(NEW)) {
        next += 1;
      }
      if (values.includes(MOD)) {
        modified += 1;
      }
    }
    return { newCount: next, modifiedCount: modified };
  }, [
    index,
    allStatuses,
    includedTagFilters,
    excludedTagFilters,
    includedStatusFilters,
    excludedStatusFilters,
  ]);

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

  const parts: string[] = [];
  if (newCount > 0) {
    parts.push(`${newCount} new`);
  }
  if (modifiedCount > 0) {
    parts.push(`${modifiedCount} changed`);
  }

  return (
    <StyledCTA
      variant="ghost"
      padding="small"
      $isActive={isReviewActive}
      aria-pressed={isReviewActive}
      aria-label={`${verb} ${parts.join(' and ')} stories`}
      onClick={onClick}
    >
      <StyledIcon viewBox="0 0 14 14" width="14" height="14" aria-hidden>
        <UseSymbol type="new" />
      </StyledIcon>
      {`${verb} ${parts.join(', ')}`}
    </StyledCTA>
  );
};

const ReviewChangesButton = () => (
  <Consumer filter={filterMapper}>
    {({
      api,
      index,
      includedTagFilters,
      excludedTagFilters,
      includedStatusFilters,
      excludedStatusFilters,
    }) => (
      <ReviewChangesButtonInner
        api={api}
        index={index}
        includedTagFilters={includedTagFilters}
        excludedTagFilters={excludedTagFilters}
        includedStatusFilters={includedStatusFilters}
        excludedStatusFilters={excludedStatusFilters}
      />
    )}
  </Consumer>
);

export default ReviewChangesButton;
