import React, { type SyntheticEvent, useMemo } from 'react';

import { Button, ToggleButton } from 'storybook/internal/components';
import type {
  API_PreparedIndexEntry,
  StatusesByStoryIdAndTypeId,
  StatusValue,
  StoryIndex,
  Tag,
} from 'storybook/internal/types';

import { UndoIcon } from '@storybook/icons';

import {
  experimental_useStatusStore,
  useStorybookApi,
  useStorybookState,
} from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { computeStatusFilterFn } from '../../../manager-api/modules/statuses.ts';
import { computeTagsFilterFn } from '../../../manager-api/modules/tags.ts';
import { UseSymbol } from './IconSymbols.tsx';

const Wrapper = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
});

const StyledCTA = styled(ToggleButton)({
  flex: 1,
  justifyContent: 'flex-start',
});

const StyledIcon = styled.svg(({ theme }) => ({
  color: theme.fgColor.accent,
}));

const NEW = 'status-value:new' as StatusValue;
const MOD = 'status-value:modified' as StatusValue;
const REVIEWING = 'status-value:reviewing' as StatusValue;

const ReviewChangesButton = () => {
  const api = useStorybookApi();
  const {
    internal_index: index,
    includedStatusFilters: rawIncludedStatusFilters,
    excludedStatusFilters: rawExcludedStatusFilters,
    includedTagFilters: rawIncludedTagFilters,
    excludedTagFilters: rawExcludedTagFilters,
  } = useStorybookState();
  const allStatuses = experimental_useStatusStore() as StatusesByStoryIdAndTypeId;

  const { newCount, modifiedCount, hasReviewingStories } = useMemo(() => {
    if (!index) {
      return { newCount: 0, modifiedCount: 0, hasReviewingStories: false };
    }
    const includedStatusFilters = (rawIncludedStatusFilters ?? []) as StatusValue[];
    const excludedStatusFilters = (rawExcludedStatusFilters ?? []) as StatusValue[];
    const includedTagFilters = (rawIncludedTagFilters ?? []) as Tag[];
    const excludedTagFilters = (rawExcludedTagFilters ?? []) as Tag[];
    const contextualIncludedStatuses = includedStatusFilters.filter((s) => s !== NEW && s !== MOD);
    const contextualExcludedStatuses = excludedStatusFilters.filter((s) => s !== NEW && s !== MOD);
    const tagFilterFn = computeTagsFilterFn(includedTagFilters, excludedTagFilters);
    const statusFilterFn = computeStatusFilterFn(
      contextualIncludedStatuses,
      contextualExcludedStatuses
    );

    let next = 0;
    let modified = 0;
    let reviewing = false;
    const entries = (index as StoryIndex).entries ?? {};
    for (const [storyId, statusesByType] of Object.entries(allStatuses)) {
      const entry = entries[storyId] as API_PreparedIndexEntry | undefined;
      if (!entry) {
        continue;
      }
      const statuses = Object.values(statusesByType);
      if (!reviewing && statuses.some(({ value }) => value === REVIEWING)) {
        reviewing = true;
      }
      const entryWithStatuses = { ...entry, statuses: statusesByType };
      if (!tagFilterFn(entryWithStatuses) || !statusFilterFn(entryWithStatuses)) {
        continue;
      }
      if (statuses.some(({ value }) => value === NEW)) {
        next += 1;
      }
      if (statuses.some(({ value }) => value === MOD)) {
        modified += 1;
      }
    }
    return { newCount: next, modifiedCount: modified, hasReviewingStories: reviewing };
  }, [
    index,
    allStatuses,
    rawIncludedStatusFilters,
    rawExcludedStatusFilters,
    rawIncludedTagFilters,
    rawExcludedTagFilters,
  ]);

  const includedStatusFilters = (rawIncludedStatusFilters ?? []) as StatusValue[];
  const excludedStatusFilters = (rawExcludedStatusFilters ?? []) as StatusValue[];
  const isReviewActive = includedStatusFilters.includes(NEW) && includedStatusFilters.includes(MOD);

  if (!globalThis.FEATURES?.changeDetection) {
    return null;
  }

  if (hasReviewingStories) {
    return null;
  }

  if (newCount === 0 && modifiedCount === 0) {
    return null;
  }

  const clearReview = () => {
    const nextIncluded = includedStatusFilters.filter((s) => s !== NEW && s !== MOD);
    const nextExcluded = excludedStatusFilters.filter((s) => s !== NEW && s !== MOD);
    api.setAllStatusFilters(nextIncluded, nextExcluded);
  };

  const onClick = () => {
    if (isReviewActive) {
      clearReview();
    } else {
      const nextIncluded = Array.from(new Set([...includedStatusFilters, NEW, MOD]));
      const nextExcluded = excludedStatusFilters.filter((s) => s !== NEW && s !== MOD);
      api.setAllStatusFilters(nextIncluded, nextExcluded);
    }
  };

  const onClearClick = (e: SyntheticEvent) => {
    e.stopPropagation();
    clearReview();
  };

  const changeKinds =
    newCount > 0 && modifiedCount > 0 ? 'new and modified' : newCount > 0 ? 'new' : 'modified';
  const label = `${isReviewActive ? 'Reviewing' : 'Review'} ${changeKinds} stories`;

  return (
    <Wrapper>
      <StyledCTA
        variant="ghost"
        padding="small"
        pressed={isReviewActive}
        ariaLabel={label}
        disableAllTooltips
        onClick={onClick}
      >
        <StyledIcon viewBox="0 0 14 14" width="14" height="14" aria-hidden>
          <UseSymbol type="modified" />
        </StyledIcon>
        {label}
      </StyledCTA>
      {isReviewActive && (
        <Button
          variant="ghost"
          padding="small"
          size="small"
          onClick={onClearClick}
          ariaLabel="Clear"
          disableAllTooltips
        >
          <UndoIcon />
        </Button>
      )}
    </Wrapper>
  );
};

export default ReviewChangesButton;
