import React, { useEffect, useRef, type FC } from 'react';
import { createPortal } from 'react-dom';

import { useNavigate } from 'storybook/internal/router';

import { REVIEW_CHANGES_URL } from './constants.ts';
import { useReview } from './review-store.ts';
import { SummaryScreen } from './screens/SummaryScreen.tsx';

const PORTAL_HOST_ID = 'storybook-review-summary-portal';

const ensurePortalHost = (): HTMLElement => {
  const existing = document.getElementById(PORTAL_HOST_ID);
  if (existing) {
    return existing;
  }
  const host = document.createElement('div');
  host.id = PORTAL_HOST_ID;
  document.getElementById('root')?.appendChild(host);
  return host;
};

export const ReviewSummaryPortal: FC = () => {
  const { isSummaryVisible, isInReviewSession, state, storyInfo, isStale, getStoryPreviewHref } =
    useReview();
  const navigate = useNavigate();
  const hostRef = useRef(ensurePortalHost());
  const summaryRef = useRef<HTMLDivElement>(null);

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

  const host = hostRef.current;
  const hiddenOnStory = isInReviewSession && !isSummaryVisible;

  return createPortal(
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 'var(--nav-width, 0px)',
        right: 0,
        bottom: 0,
        zIndex: isSummaryVisible ? 5 : 0,
        display: isInReviewSession ? 'flex' : 'none',
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
    </div>,
    host
  );
};
