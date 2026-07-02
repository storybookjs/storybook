import React, { useSyncExternalStore, type FC } from 'react';

import { styled } from 'storybook/theming';

import { PRE_REVIEW_RETURN_KEY } from '../constants.ts';
import { reviewStore, useReview } from '../review-store.ts';
import { sessionStore } from '../session-store.ts';
import { SummaryScreen } from './SummaryScreen.tsx';

const useSummaryOverlayShown = () =>
  useSyncExternalStore(
    reviewStore.subscribe,
    () => reviewStore.isSummaryOverlayShown(),
    () => reviewStore.isSummaryOverlayShown()
  );

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
  const {
    state,
    storyInfo,
    isStale,
    hasPendingUpdate,
    onAcceptPendingUpdate,
    getStoryPreviewHref,
    dismissReview,
    isInReviewMode,
    isSummaryVisible,
  } = useReview();
  const overlayShown = useSummaryOverlayShown();

  // Mount on the summary route (so the page renders) and throughout review mode
  // (so hidden thumbnail iframes survive round-trips to individual stories).
  if (!isSummaryVisible && !isInReviewMode) {
    return null;
  }

  return (
    <SummaryHost
      ref={(node) => {
        if (node) {
          node.inert = !overlayShown;
        }
      }}
      $visible={overlayShown}
      data-review-summary={overlayShown ? 'visible' : 'hidden'}
    >
      <SummaryScreen
        state={state}
        storyInfo={storyInfo}
        getStoryPreviewHref={getStoryPreviewHref}
        isStale={isStale && !hasPendingUpdate}
        hasPendingUpdate={hasPendingUpdate}
        onAcceptPendingUpdate={onAcceptPendingUpdate}
        previewsPaused={!overlayShown}
        onDismiss={dismissReview}
        returnSearch={sessionStore.read(PRE_REVIEW_RETURN_KEY)}
      />
    </SummaryHost>
  );
};
