import React, { useEffect, useRef, type FC } from 'react';

import { useNavigate } from 'storybook/internal/router';
import { useStorybookState } from 'storybook/manager-api';

import { isReviewSummaryPath, isStoryInReview, parseStoryIdFromPath } from './review-navigation.ts';
import { useReview } from './review-store.ts';
import { SummaryScreen } from './screens/SummaryScreen.tsx';

const PORTAL_HOST_ID = 'storybook-review-summary-portal';

/** Remove a stale portal host left from earlier implementations. */
const removeLegacyPortalHost = () => {
  document.getElementById(PORTAL_HOST_ID)?.remove();
};

export const ReviewSummaryPortal: FC = () => {
  const { path, viewMode } = useStorybookState();
  const { state, storyInfo, isStale, getStoryPreviewHref, flattenedEntries } = useReview();
  const navigate = useNavigate();
  const summaryRef = useRef<HTMLDivElement>(null);

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
  const containerRef = useRef<HTMLDivElement>(null);
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
      navigate(href, { plain: true });
    };
    container.addEventListener('click', onClick);
    return () => container.removeEventListener('click', onClick);
  }, [navigate]);

  useEffect(() => {
    const node = summaryRef.current;
    if (node) {
      node.inert = !isSummaryVisible;
    }
  }, [isSummaryVisible]);

  if (!isInReviewSession) {
    return null;
  }

  const hiddenOnStory = !isSummaryVisible;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 'var(--nav-width, 0px)',
        right: 0,
        bottom: 0,
        zIndex: isSummaryVisible ? 10 : 0,
        display: 'flex',
        flexDirection: 'column',
        pointerEvents: isSummaryVisible ? 'auto' : 'none',
        visibility: hiddenOnStory ? 'hidden' : 'visible',
      }}
      aria-hidden={hiddenOnStory || undefined}
      data-review-summary={isSummaryVisible ? 'visible' : 'hidden'}
    >
      <div ref={summaryRef} style={{ display: 'contents' }}>
        <SummaryScreen
          state={state}
          storyInfo={storyInfo}
          getStoryPreviewHref={getStoryPreviewHref}
          isStale={isStale}
        />
      </div>
    </div>
  );
};
