import React, { type SyntheticEvent, useEffect, useMemo, useState } from 'react';

import { ActionList, Card } from 'storybook/internal/components';
import type { StatusesByStoryIdAndTypeId, StoryIndex } from 'storybook/internal/types';

import { CloseAltIcon, WandIcon } from '@storybook/icons';

import {
  experimental_useStatusStore,
  useChannel,
  useStorybookApi,
  useStorybookState,
} from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { REVIEW_EVENTS } from '../../../shared/review/index.ts';
import { REVIEW_CHANGES_URL } from '../review/constants.ts';
import { enterReviewMode } from '../review/review-mode.ts';
import { useReview } from '../review/review-store.ts';
import { REVIEWING_STATUS_VALUE as REVIEWING } from '../review/review-status.ts';

type ReviewPayload = {
  title: string;
};

const HeaderContent = styled(ActionList.Text)({
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'flex-start',
  alignItems: 'center',
  gap: 6,
});

const HeaderTitle = styled.strong(({ theme }) => ({
  color: theme.color.defaultText,
  fontWeight: theme.typography.weight.bold,
  fontSize: theme.typography.size.s1,
  lineHeight: `${theme.typography.size.s3}px`,
}));

const AgenticIcon = styled(WandIcon)(({ theme }) => ({
  color: theme.fgColor.agentic,
}));

const DismissIcon = styled(CloseAltIcon)({
  padding: 1,
});

export const useReviewingStoryCount = () => {
  const { internal_index: index } = useStorybookState();
  const allStatuses = experimental_useStatusStore() as StatusesByStoryIdAndTypeId;

  return useMemo(() => {
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
};

const useActiveReviewTitle = () => {
  const [title, setTitle] = useState<string | null>(null);

  const emit = useChannel({
    [REVIEW_EVENTS.DISPLAY_REVIEW]: (review: ReviewPayload) => {
      setTitle(review.title);
    },
    [REVIEW_EVENTS.REVIEW_DISMISSED]: () => {
      setTitle(null);
    },
  });

  useEffect(() => {
    emit(REVIEW_EVENTS.REQUEST_REVIEW);
  }, [emit]);

  return title;
};

export const ReviewWidget = () => {
  const api = useStorybookApi();
  const storyCount = useReviewingStoryCount();
  const reviewTitle = useActiveReviewTitle();
  const { reviewedCount } = useReview();
  const {
    includedStatusFilters = [],
    excludedStatusFilters = [],
    includedTagFilters = [],
    excludedTagFilters = [],
  } = useStorybookState();

  const emit = useChannel({});

  if (!api.getIsNavShown()) {
    return null;
  }

  if (storyCount === 0) {
    return null;
  }

  const onOpen = () => {
    void (async () => {
      try {
        await enterReviewMode(api, {
          includedStatusFilters,
          excludedStatusFilters,
          includedTagFilters,
          excludedTagFilters,
        });
      } catch {
        // Best-effort: still continue into the review route.
      }
      api.navigate(REVIEW_CHANGES_URL);
    })();
  };

  const onDismiss = (event: SyntheticEvent) => {
    event.stopPropagation();
    emit(REVIEW_EVENTS.DISMISS_REVIEW);
  };

  const storyLabel = storyCount === 1 ? 'story' : 'stories';
  const remaining = Math.max(0, storyCount - reviewedCount);
  const isComplete = remaining === 0;
  const progressText = isComplete
    ? 'Review complete'
    : reviewedCount === 0
      ? `Review ${storyCount} ${storyLabel}`
      : `${remaining} ${remaining === 1 ? 'story' : 'stories'} left to review`;

  return (
    <Card
      color="agentic"
      outlineAnimation={isComplete ? 'none' : 'spin'}
      id="storybook-review-widget"
    >
      <ActionList as="div">
        <ActionList.Item as="div">
          <HeaderContent>
            <AgenticIcon aria-hidden />
            <HeaderTitle>Quick review</HeaderTitle>
          </HeaderContent>
          <ActionList.Button appearance="agentic" ariaLabel="Dismiss review" onClick={onDismiss}>
            <DismissIcon />
          </ActionList.Button>
        </ActionList.Item>
      </ActionList>
      <ActionList>
        <ActionList.Item>
          <ActionList.Action
            ariaLabel={reviewTitle ? `${progressText}: ${reviewTitle}` : progressText}
            disableAllTooltips
            appearance="agentic"
            onClick={onOpen}
          >
            <ActionList.Text>
              <strong>{progressText}</strong>
              {reviewTitle ? <small>{reviewTitle}</small> : null}
            </ActionList.Text>
          </ActionList.Action>
        </ActionList.Item>
      </ActionList>
    </Card>
  );
};

export default ReviewWidget;
