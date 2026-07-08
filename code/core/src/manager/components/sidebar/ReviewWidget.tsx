import React, { useMemo, type SyntheticEvent } from 'react';

import { ActionList, Card } from 'storybook/internal/components';

import { CloseAltIcon, WandIcon } from '@storybook/icons';

import { useNavigate } from 'storybook/internal/router';
import { useChannel, useStorybookApi, useStorybookState } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { EVENTS } from '../review/constants.ts';
import { navigateToReviewSummary } from '../review/review-actions.ts';
import { collectReviewStoryIds } from '../review/review-status.ts';
import { useReview } from '../review/review-store.ts';

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

/** Story count for the displayed review payload, not the sidebar status store. */
export const useActiveReviewStoryCount = () => {
  const { state } = useReview();

  return useMemo(() => (state ? collectReviewStoryIds(state).size : 0), [state]);
};

const useActiveReviewTitle = () => {
  const { state } = useReview();
  return state?.title ?? null;
};

export const ReviewWidget = () => {
  const api = useStorybookApi();
  const navigate = useNavigate();
  const storyCount = useActiveReviewStoryCount();
  const reviewTitle = useActiveReviewTitle();
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
    navigateToReviewSummary(api, navigate, {
      includedStatusFilters,
      excludedStatusFilters,
      includedTagFilters,
      excludedTagFilters,
    });
  };

  const onDismiss = (event: SyntheticEvent) => {
    event.stopPropagation();
    emit(EVENTS.DISMISS_REVIEW);
  };

  const storyLabel = storyCount === 1 ? 'story' : 'stories';

  return (
    <Card color="agentic" outlineAnimation="spin" id="storybook-review-widget">
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
            ariaLabel={
              reviewTitle
                ? `Review ${storyCount} ${storyLabel}: ${reviewTitle}`
                : `Review ${storyCount} ${storyLabel}`
            }
            disableAllTooltips
            appearance="agentic"
            onClick={onOpen}
          >
            <ActionList.Text>
              <strong>
                Review {storyCount} {storyLabel}
              </strong>
              {reviewTitle ? <small>{reviewTitle}</small> : null}
            </ActionList.Text>
          </ActionList.Action>
        </ActionList.Item>
      </ActionList>
    </Card>
  );
};

export default ReviewWidget;
