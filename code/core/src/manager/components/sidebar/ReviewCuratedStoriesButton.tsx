import React, { type SyntheticEvent, useMemo, useRef } from 'react';

import { Button, ToggleButton } from 'storybook/internal/components';
import type {
  StatusValue,
  StatusesByStoryIdAndTypeId,
  StoryIndex,
  Tag,
} from 'storybook/internal/types';

import { CloseIcon } from '@storybook/icons';

import {
  experimental_useStatusStore,
  useStorybookApi,
  useStorybookState,
} from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { UseSymbol } from './IconSymbols.tsx';

/** Matches `@storybook/addon-review` experimental page URL. */
const REVIEW_SUMMARY_PATH = '/review/';

const REVIEWING = 'status-value:reviewing' as StatusValue;

type FilterSnapshot = {
  includedTagFilters: Tag[];
  excludedTagFilters: Tag[];
  includedStatusFilters: StatusValue[];
  excludedStatusFilters: StatusValue[];
};

const Wrapper = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
});

const StyledCTA = styled(ToggleButton)(({ theme }) => {
  const surface = {
    color: theme.fgColor.agentic,
    background: theme.bgColor.agentic,
    boxShadow: `inset 0 0 0 1px ${theme.borderColor.agentic}`,
  };

  return {
    flex: 1,
    justifyContent: 'flex-start',
    '&&, &&:active': surface,
    '&&:hover': {
      ...surface,
      boxShadow: `inset 0 0 0 1px ${theme.fgColor.agentic}`,
    },
    '&&:focus-visible': {
      ...surface,
      outline: `2px solid ${theme.fgColor.agentic}`,
      outlineOffset: 2,
      zIndex: 1,
    },
  };
});

const isCuratedFilterActive = (
  includedTagFilters: Tag[],
  excludedTagFilters: Tag[],
  includedStatusFilters: StatusValue[],
  excludedStatusFilters: StatusValue[]
) =>
  includedTagFilters.length === 0 &&
  excludedTagFilters.length === 0 &&
  includedStatusFilters.length === 1 &&
  includedStatusFilters[0] === REVIEWING &&
  excludedStatusFilters.length === 0;

const ReviewCuratedStoriesButton = () => {
  const api = useStorybookApi();
  const {
    internal_index: index,
    includedStatusFilters: rawIncludedStatusFilters,
    excludedStatusFilters: rawExcludedStatusFilters,
    includedTagFilters: rawIncludedTagFilters,
    excludedTagFilters: rawExcludedTagFilters,
  } = useStorybookState();
  const allStatuses = experimental_useStatusStore() as StatusesByStoryIdAndTypeId;
  const savedFiltersRef = useRef<FilterSnapshot | null>(null);

  const reviewingCount = useMemo(() => {
    if (!index) {
      return 0;
    }
    const entries = (index as StoryIndex).entries ?? {};
    let count = 0;
    for (const [storyId, statusesByType] of Object.entries(allStatuses)) {
      if (!entries[storyId]) {
        continue;
      }
      if (Object.values(statusesByType).some(({ value }) => value === REVIEWING)) {
        count += 1;
      }
    }
    return count;
  }, [index, allStatuses]);

  const includedStatusFilters = (rawIncludedStatusFilters ?? []) as StatusValue[];
  const excludedStatusFilters = (rawExcludedStatusFilters ?? []) as StatusValue[];
  const includedTagFilters = (rawIncludedTagFilters ?? []) as Tag[];
  const excludedTagFilters = (rawExcludedTagFilters ?? []) as Tag[];

  const isCuratedActive = isCuratedFilterActive(
    includedTagFilters,
    excludedTagFilters,
    includedStatusFilters,
    excludedStatusFilters
  );

  if (reviewingCount === 0) {
    return null;
  }

  const restoreFilters = async (snapshot: FilterSnapshot) => {
    await api.setAllTagFilters(snapshot.includedTagFilters, snapshot.excludedTagFilters);
    await api.setAllStatusFilters(snapshot.includedStatusFilters, snapshot.excludedStatusFilters);
  };

  const clearCurated = async () => {
    const saved = savedFiltersRef.current;
    savedFiltersRef.current = null;
    if (saved) {
      await restoreFilters(saved);
      return;
    }
    await api.setAllTagFilters([], []);
    await api.setAllStatusFilters([], []);
  };

  const onClick = async () => {
    if (isCuratedActive) {
      await clearCurated();
      return;
    }

    savedFiltersRef.current = {
      includedTagFilters,
      excludedTagFilters,
      includedStatusFilters,
      excludedStatusFilters,
    };
    await api.setAllTagFilters([], []);
    await api.setAllStatusFilters([REVIEWING], []);
    api.toggleNav(false);
    api.navigate(REVIEW_SUMMARY_PATH);
  };

  const onClearClick = (e: SyntheticEvent) => {
    e.stopPropagation();
    void clearCurated();
  };

  const label = isCuratedActive ? 'Reviewing AI-curated stories' : 'Review AI-curated stories';

  return (
    <Wrapper>
      <StyledCTA
        variant="outline"
        padding="small"
        pressed={isCuratedActive}
        ariaLabel={label}
        disableAllTooltips
        onClick={() => void onClick()}
      >
        <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden>
          <UseSymbol type="reviewing" />
        </svg>
        {label}
      </StyledCTA>
      {isCuratedActive && (
        <Button
          variant="ghost"
          padding="small"
          size="small"
          onClick={onClearClick}
          ariaLabel="Clear"
          disableAllTooltips
        >
          <CloseIcon />
        </Button>
      )}
    </Wrapper>
  );
};

export default ReviewCuratedStoriesButton;
