import React, { useEffect, useRef, useSyncExternalStore, type FC } from 'react';

import { useNavigate } from 'storybook/internal/router';
import { useStorybookState } from 'storybook/manager-api';

import { isReviewSummaryPath, isStoryInReview, parseStoryIdFromPath } from './review-navigation.ts';
import { reviewStore, useReview } from './review-store.ts';
import { SummaryScreen } from './screens/SummaryScreen.tsx';

const PORTAL_HOST_ID = 'storybook-review-summary-portal';

/** Remove a stale portal host left from earlier implementations. */
const removeLegacyPortalHost = () => {
  document.getElementById(PORTAL_HOST_ID)?.remove();
};

const useSummaryOverlayShown = () =>
  useSyncExternalStore(
    reviewStore.subscribe,
    () => reviewStore.isSummaryOverlayShown(),
    () => reviewStore.isSummaryOverlayShown()
  );

export const ReviewSummaryPortal: FC = () => {
  const { path, viewMode } = useStorybookState();
  const { state, storyInfo, isStale, getStoryPreviewHref, flattenedEntries } = useReview();
  const overlayShown = useSummaryOverlayShown();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    removeLegacyPortalHost();
  }, []);

  const isSummaryVisible = isReviewSummaryPath(path);
  const storyIdFromPath = parseStoryIdFromPath(path);
  const isOnReviewedStory =
    viewMode === 'story' &&
    storyIdFromPath !== null &&
    isStoryInReview(flattenedEntries, storyIdFromPath);
  const isInReviewSession = isSummaryVisible || isOnReviewedStory;

  // SPA navigation for in-page review links (summary → story, prev/next on summary grid).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const { target } = event;
      const anchor = target instanceof Element ? target.closest('a') : null;
      const href = anchor?.getAttribute('href');
      if (!href?.startsWith('?path=')) {
        return;
      }
      event.preventDefault();
      if (href.startsWith('?path=/story/')) {
        reviewStore.suppressSummaryOverlay();
      }
      navigate(href, { plain: true });
    };
    container.addEventListener('click', onClick);
    return () => container.removeEventListener('click', onClick);
  }, [navigate, isInReviewSession]);

  useEffect(() => {
    const node = containerRef.current;
    if (node) {
      node.inert = !overlayShown;
    }
  }, [overlayShown]);

  if (!isInReviewSession) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 'var(--nav-width, 0px)',
        right: 0,
        bottom: 0,
        zIndex: overlayShown ? 10 : -1,
        display: 'flex',
        flexDirection: 'column',
        visibility: overlayShown ? 'visible' : 'hidden',
        pointerEvents: overlayShown ? 'auto' : 'none',
      }}
      aria-hidden={!overlayShown || undefined}
      data-review-summary={overlayShown ? 'visible' : 'hidden'}
    >
      <SummaryScreen
        state={state}
        storyInfo={storyInfo}
        getStoryPreviewHref={getStoryPreviewHref}
        isStale={isStale}
        previewsPaused={!overlayShown}
      />
    </div>
  );
};
