import React, { useMemo, useRef, type SyntheticEvent } from 'react';

import { ActionList, Card } from 'storybook/internal/components';

import { CloseAltIcon, WandIcon } from '@storybook/icons';

import { useStorybookApi } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { useLandmark } from '../../hooks/useLandmark.ts';
import { useReviewContext } from '../review/review-context.ts';
import { collectReviewStoryIds } from '../review/review-status.ts';

const HEADING_ID = 'storybook-review-widget-heading';

// Landmark wrapper so the review widget is reachable via F6 and announced as a
// named region; the Card provides the visuals. A plain block (not
// `display: contents`) keeps the region reliably exposed in the a11y tree.
const Region = styled.section({
  width: '100%',
});

const HeaderContent = styled(ActionList.Text)({
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'flex-start',
  alignItems: 'center',
  gap: 6,
  // Reserve room for the dismiss button, which is positioned in the top-right
  // corner so it comes last in the tab order (after the review action).
  paddingRight: 24,
});

const HeaderTitle = styled.h2(({ theme }) => ({
  margin: 0,
  color: theme.color.defaultText,
  fontWeight: theme.typography.weight.bold,
  fontSize: theme.typography.size.s1,
  lineHeight: `${theme.typography.size.s3}px`,
}));

const AgenticIcon = styled(WandIcon)(({ theme }) => ({
  color: theme.fgColor.agentic,
}));

const DismissButton = styled(ActionList.Button)({
  position: 'absolute',
  top: 4,
  right: 4,
  zIndex: 1,
});

const DismissIcon = styled(CloseAltIcon)({
  padding: 1,
});

/** Story count for the displayed review payload, not the sidebar status store. */
export const useActiveReviewStoryCount = () => {
  const { review } = useReviewContext();

  return useMemo(() => (review ? collectReviewStoryIds(review).size : 0), [review]);
};

const useActiveReviewTitle = () => {
  const { review } = useReviewContext();
  return review?.title ?? null;
};

export const ReviewWidget = () => {
  const api = useStorybookApi();
  const { openSummary, dismiss } = useReviewContext();
  const storyCount = useActiveReviewStoryCount();
  const reviewTitle = useActiveReviewTitle();

  const regionRef = useRef<HTMLElement>(null);
  const { landmarkProps } = useLandmark(
    { role: 'region', 'aria-labelledby': HEADING_ID },
    regionRef
  );

  if (!api.getIsNavShown()) {
    return null;
  }

  if (storyCount === 0) {
    return null;
  }

  const onOpen = () => {
    openSummary();
  };

  const onDismiss = (event: SyntheticEvent) => {
    event.stopPropagation();
    dismiss();
  };

  const storyLabel = storyCount === 1 ? 'story' : 'stories';

  // The dismiss button is rendered last (and pinned to the top-right corner) so
  // the review action comes before it in the tab order.
  return (
    <Region ref={regionRef} {...landmarkProps}>
      <Card color="agentic" outlineAnimation="spin" id="storybook-review-widget">
        <ActionList as="div">
          <ActionList.Item as="div">
            <HeaderContent>
              <AgenticIcon aria-hidden />
              <HeaderTitle id={HEADING_ID}>Quick review</HeaderTitle>
            </HeaderContent>
          </ActionList.Item>
        </ActionList>
        <ActionList as="div">
          <ActionList.Item as="div">
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
        <DismissButton appearance="agentic" ariaLabel="Dismiss review" onClick={onDismiss}>
          <DismissIcon />
        </DismissButton>
      </Card>
    </Region>
  );
};

export default ReviewWidget;
