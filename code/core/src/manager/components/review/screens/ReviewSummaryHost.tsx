import React, { useCallback, type FC } from 'react';

import { useStorybookApi } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { PRE_REVIEW_RETURN_KEY } from '../constants.ts';
import { dismissReview } from '../review-actions.ts';
import { useReview } from '../review-store.ts';
import { sessionStore } from '../session-store.ts';
import { SummaryScreen } from './SummaryScreen.tsx';

// Fills the layout's content overlay cell. While a reviewed story is open the
// host stays mounted but hidden (visibility, not display or unmount) so
// thumbnail iframes keep their documents alive.
const SummaryHost = styled.div<{ $visible: boolean }>(({ $visible }) => ({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  visibility: $visible ? 'visible' : 'hidden',
  pointerEvents: $visible ? 'auto' : 'none',
}));

export const ReviewSummaryHost: FC = () => {
  const api = useStorybookApi();
  const { state, storyInfo, banner, isInReviewMode, isSummaryVisible } = useReview();
  const getStoryPreviewHref = useCallback(
    (storyId: string) => api.getStoryHrefs(storyId, { embed: true, freeze: true }).previewHref,
    [api]
  );
  const onDismiss = useCallback(() => {
    void dismissReview(api);
  }, [api]);

  // Mount on the summary route (so the page renders) and throughout review mode
  // (so hidden thumbnail iframes survive round-trips to individual stories).
  if (!isSummaryVisible && !isInReviewMode) {
    return null;
  }

  return (
    <SummaryHost
      ref={(node) => {
        if (node) {
          node.inert = !isSummaryVisible;
        }
      }}
      $visible={isSummaryVisible}
      // Also mark the hidden host aria-hidden: @react-aria/landmark's F6 cycle
      // only skips landmarks inside `[aria-hidden=true]` (not `inert`), so without
      // this the hidden summary's collection/footer landmarks stay in the cycle
      // but can't be focused, trapping F6 on the preview.
      aria-hidden={!isSummaryVisible ? true : undefined}
      data-review-summary={isSummaryVisible ? 'visible' : 'hidden'}
    >
      <SummaryScreen
        state={state}
        storyInfo={storyInfo}
        getStoryPreviewHref={getStoryPreviewHref}
        banner={banner}
        summaryHidden={!isSummaryVisible}
        onDismiss={onDismiss}
        returnSearch={sessionStore.read(PRE_REVIEW_RETURN_KEY)}
      />
    </SummaryHost>
  );
};
