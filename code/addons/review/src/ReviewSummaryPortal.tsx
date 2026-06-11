import React, { useLayoutEffect, useRef, useState, useSyncExternalStore, type FC } from 'react';
import { createPortal } from 'react-dom';

import { useStorybookState } from 'storybook/manager-api';

import {
  isReviewSessionPath,
  isReviewSummaryPath,
  isStoryInReview,
  parseCollectionIndex,
  parseStoryIdFromPath,
} from './review-navigation.ts';
import { reviewStore, useReview } from './review-store.ts';
import { SummaryScreen } from './screens/SummaryScreen.tsx';

/** Matches `#main-content-wrapper` in core MainAreaContainer — the pages grid cell beside the sidebar. */
export const REVIEW_SUMMARY_PORTAL_TARGET_ID = 'main-content-wrapper';

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

const useMainContentPortalTarget = (enabled: boolean): HTMLElement | null => {
  const [target, setTarget] = useState<HTMLElement | null>(() =>
    enabled ? document.getElementById(REVIEW_SUMMARY_PORTAL_TARGET_ID) : null
  );

  useLayoutEffect(() => {
    if (!enabled) {
      setTarget(null);
      return undefined;
    }

    const resolve = () => {
      const node = document.getElementById(REVIEW_SUMMARY_PORTAL_TARGET_ID);
      setTarget(node);
      return node;
    };

    if (resolve()) {
      return undefined;
    }

    const observer = new MutationObserver(() => {
      if (resolve()) {
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [enabled]);

  return target;
};

const summaryPortalStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  height: '100%',
  overflow: 'hidden',
};

export const ReviewSummaryPortal: FC = () => {
  const { path, viewMode, customQueryParams } = useStorybookState();
  const {
    state,
    storyInfo,
    isStale,
    getStoryPreviewHref,
    flattenedEntries,
    dismissReview,
    lastReviewedStoryHref,
  } = useReview();
  const overlayShown = useSummaryOverlayShown();
  const containerRef = useRef<HTMLDivElement>(null);
  const portalTarget = useMainContentPortalTarget(overlayShown);

  useLayoutEffect(() => {
    removeLegacyPortalHost();
  }, []);

  const isSummaryVisible = isReviewSummaryPath(path);
  const collectionParam = customQueryParams?.collection as string | undefined;
  const collectionIndex = parseCollectionIndex(collectionParam);
  const storyIdFromPath = parseStoryIdFromPath(path);
  const isOnReviewedStory =
    viewMode === 'story' &&
    storyIdFromPath !== null &&
    isStoryInReview(flattenedEntries, storyIdFromPath);
  const isInReviewSession = isReviewSessionPath(path, collectionIndex) || isOnReviewedStory;

  useLayoutEffect(() => {
    const node = containerRef.current;
    if (node) {
      node.inert = !overlayShown;
    }
  }, [overlayShown]);

  if (!isInReviewSession) {
    return null;
  }

  const summaryScreen = (
    <SummaryScreen
      state={state}
      storyInfo={storyInfo}
      getStoryPreviewHref={getStoryPreviewHref}
      isStale={isStale}
      previewsPaused={!overlayShown}
      onDismiss={dismissReview}
      lastReviewedStoryHref={lastReviewedStoryHref}
    />
  );

  if (overlayShown) {
    const portalContent = (
      <div ref={containerRef} style={summaryPortalStyle} data-review-summary="visible">
        {summaryScreen}
      </div>
    );

    if (portalTarget) {
      return createPortal(portalContent, portalTarget);
    }

    // Isolated stories and the first paint before Layout mounts: fill the viewport.
    return (
      <div
        ref={containerRef}
        style={{
          ...summaryPortalStyle,
          position: 'fixed',
          inset: 0,
          zIndex: 10,
        }}
        data-review-summary="visible"
      >
        {summaryScreen}
      </div>
    );
  }

  return (
    <div ref={containerRef} aria-hidden style={{ display: 'none' }} data-review-summary="hidden">
      {summaryScreen}
    </div>
  );
};
