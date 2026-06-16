import React, { useLayoutEffect, useRef, useState, useSyncExternalStore, type FC } from 'react';
import { createPortal } from 'react-dom';

import { useStorybookApi, useStorybookState } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import {
  isReviewSessionPath,
  isStoryInReview,
  parseCollectionIndex,
  parseStoryIdFromPath,
} from './review-navigation.ts';
import { reviewStore, useReview } from './review-store.ts';
import { SummaryScreen } from './screens/SummaryScreen.tsx';

const LEGACY_PORTAL_HOST_ID = 'storybook-review-summary-portal';
const DESKTOP_BREAKPOINT_PX = 600;

type ChromeInsets = { left: number; right: number; bottom: number };

const useDesktopChromeInsets = (): ChromeInsets => {
  const api = useStorybookApi();
  const { layout } = useStorybookState();
  const [isDesktop, setIsDesktop] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT_PX}px)`).matches
  );

  useLayoutEffect(() => {
    const mediaQuery = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT_PX}px)`);
    const onChange = () => setIsDesktop(mediaQuery.matches);
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, []);

  if (!isDesktop || !layout) {
    return { left: 0, right: 0, bottom: 0 };
  }

  const navSize = api.getNavSizeWithCustomisations?.(layout.navSize) ?? layout.navSize;
  const { panelPosition, rightPanelWidth, bottomPanelHeight } = layout;
  const isPanelShown = api.getIsPanelShown?.() ?? false;

  return {
    left: api.getIsNavShown?.() ? navSize : 0,
    right: isPanelShown && panelPosition === 'right' ? rightPanelWidth : 0,
    bottom: isPanelShown && panelPosition === 'bottom' ? bottomPanelHeight : 0,
  };
};

const useSummaryOverlayShown = () =>
  useSyncExternalStore(
    reviewStore.subscribe,
    () => reviewStore.isSummaryOverlayShown(),
    () => reviewStore.isSummaryOverlayShown()
  );

// One stable host for the portal: never reparented, never display:none. While a
// reviewed story is open the host is parked off-screen so thumbnail iframes
// keep their documents alive. Insets come from manager layout state because this
// host renders outside the layout grid and cannot inherit its CSS variables.
const SummaryHost = styled.div<{ $visible: boolean; $insets: ChromeInsets }>(
  ({ $visible, $insets }) => ({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    height: '100%',
    overflow: 'hidden',
    position: 'fixed',
    top: 0,
    ...($visible
      ? {
          visibility: 'visible',
          pointerEvents: 'auto',
          zIndex: 2,
          left: $insets.left,
          right: $insets.right,
          bottom: $insets.bottom,
        }
      : {
          visibility: 'hidden',
          pointerEvents: 'none',
          zIndex: -1,
          left: '-10000px',
          right: 0,
          bottom: 0,
          width: '100vw',
        }),
  })
);

export const ReviewSummaryPortal: FC = () => {
  const { path, viewMode, customQueryParams } = useStorybookState();
  const chromeInsets = useDesktopChromeInsets();
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
  const [portalHost, setPortalHost] = useState<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);

  const collectionParam = customQueryParams?.collection as string | undefined;
  const collectionIndex = parseCollectionIndex(collectionParam);
  const storyIdFromPath = parseStoryIdFromPath(path);
  const isOnReviewedStory =
    viewMode === 'story' &&
    storyIdFromPath !== null &&
    isStoryInReview(flattenedEntries, storyIdFromPath);
  const isInReviewSession = isReviewSessionPath(path, collectionIndex) || isOnReviewedStory;

  useLayoutEffect(() => {
    document.getElementById(LEGACY_PORTAL_HOST_ID)?.remove();
  }, []);

  useLayoutEffect(() => {
    const node = hostRef.current;
    if (node) {
      node.inert = !overlayShown;
    }
  }, [overlayShown, portalHost]);

  if (!isInReviewSession) {
    return null;
  }

  return (
    <>
      <SummaryHost
        ref={(node) => {
          hostRef.current = node;
          setPortalHost(node);
        }}
        $visible={overlayShown}
        $insets={chromeInsets}
        aria-hidden={!overlayShown}
        data-review-summary={overlayShown ? 'visible' : 'hidden'}
      />
      {portalHost &&
        createPortal(
          <SummaryScreen
            state={state}
            storyInfo={storyInfo}
            getStoryPreviewHref={getStoryPreviewHref}
            isStale={isStale}
            previewsPaused={!overlayShown}
            onDismiss={dismissReview}
            lastReviewedStoryHref={lastReviewedStoryHref}
          />,
          portalHost
        )}
    </>
  );
};
