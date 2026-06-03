import React, { type FC, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import { useChannel, useStorybookApi, useStorybookState } from 'storybook/manager-api';
import { Location, type RenderData, useNavigate } from 'storybook/internal/router';

import type { StoryInfo } from './components/CollectionGrid.tsx';
import { EVENTS, RESTORE_NAV_SESSION_KEY, REVIEW_CHANGES_URL } from './constants.ts';
import { groupStoriesByComponent, prettifyComponentId } from './review-grouping.ts';
import {
  buildReviewChangesDetailHref,
  buildReviewChangesSummaryHref,
  normalizeReviewStoryId,
  parseReviewChangesActiveTab,
  parseReviewChangesDetailLocation,
  type ReviewTab,
} from './review-navigation.ts';
import type { ReviewState } from './review-state.ts';
import { DetailsScreen } from './screens/DetailsScreen.tsx';
import { SummaryScreen } from './screens/SummaryScreen.tsx';

// Reading `location.search` from the router (rather than window.location)
// makes the page re-render on every in-page navigation, so the detail screen
// can swap stories without a manager reload.
export const ReviewPage: FC = () =>
  React.createElement(Location, null, (({ location }: RenderData) =>
    React.createElement(ReviewPageContent, {
      search: location.search ?? '',
    })) as unknown as ReactNode);

const ReviewPageContent: FC<{ search: string }> = ({ search }) => {
  const [state, setState] = useState<ReviewState | null>(null);

  const api = useStorybookApi();
  const { index } = useStorybookState();
  const navigate = useNavigate();

  const emit = useChannel({
    [EVENTS.DISPLAY_REVIEW]: (next: ReviewState) => {
      const normalizedState: ReviewState = {
        ...next,
        collections: next.collections.map((collection) => ({
          ...collection,
          storyIds: collection.storyIds.map((storyId) => normalizeReviewStoryId(storyId)),
        })),
      };
      setState(normalizedState);
    },
  });

  // Late/refreshed tab: ask the server to replay the cached overlay.
  useEffect(() => {
    emit(EVENTS.REQUEST_REVIEW);
  }, [emit]);

  const activeTab = parseReviewChangesActiveTab(search);
  const detailLocation = parseReviewChangesDetailLocation(search);

  // Keep the summary route canonical: `/review/` immediately becomes
  // `/review/<tab>` so tab state is represented in the path.
  useEffect(() => {
    const params = new URLSearchParams(search);
    const path = params.get('path');
    const isLegacySummaryPath =
      path === REVIEW_CHANGES_URL || path === REVIEW_CHANGES_URL.slice(0, -1);
    if (isLegacySummaryPath && !detailLocation) {
      navigate(buildReviewChangesSummaryHref(activeTab), { plain: true });
    }
  }, [activeTab, detailLocation, navigate, search]);

  // The review page is a focused, full-width surface — hide the manager
  // sidebar while it is open and restore it on the way out. The user's prior
  // sidebar state is stashed in sessionStorage so it survives the full-reload
  // navigations between review screens; the cleanup restores it when the user
  // leaves (unmount also fires on browser back/forward, which the manager
  // router handles as an SPA transition). A user who keeps the sidebar
  // collapsed by choice ('keep') is left untouched.
  useEffect(() => {
    if (sessionStorage.getItem(RESTORE_NAV_SESSION_KEY) === null) {
      sessionStorage.setItem(RESTORE_NAV_SESSION_KEY, api.getIsNavShown() ? 'restore' : 'keep');
    }
    api.toggleNav(false);

    return () => {
      if (sessionStorage.getItem(RESTORE_NAV_SESSION_KEY) === 'restore') {
        api.toggleNav(true);
      }
      sessionStorage.removeItem(RESTORE_NAV_SESSION_KEY);
    };
  }, [api]);

  // Resolve each story's component title + name from the Storybook index.
  // Drives the Components tab headers and the floating thumbnail labels;
  // falls back gracefully (per-consumer) when the index has not loaded.
  const storyInfo = useMemo(() => {
    const info: Record<string, StoryInfo> = {};
    if (!state) {
      return info;
    }
    for (const collection of state.collections) {
      for (const storyId of collection.storyIds) {
        if (storyId in info) {
          continue;
        }
        const entry = index?.[storyId];
        if (entry && 'title' in entry && entry.title) {
          info[storyId] = { title: entry.title, name: entry.name };
        }
      }
    }
    return info;
  }, [index, state]);

  // SPA navigation: imperatively attach a click listener to the container so
  // left-clicks on in-page review links push history and swap the iframe URL
  // without a manager reload (no flash). Real hrefs are kept for accessibility
  // / middle-click / open-in-new-tab, which fall through untouched. Done via
  // an effect rather than `onClick` on a div so `jsx-a11y/no-static-element-
  // interactions` doesn't flag the delegation root — the div isn't itself
  // interactive, it's just catching bubbled clicks from real <a> elements.
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
      // `event.target` can be a non-Element node (e.g. a Text node), which has
      // no `closest`; guard before treating it as an Element.
      const { target } = event;
      const anchor = target instanceof Element ? target.closest('a') : null;
      const href = anchor?.getAttribute('href');
      if (!href || !href.startsWith(`?path=${REVIEW_CHANGES_URL}`)) {
        return;
      }
      event.preventDefault();
      navigate(href, { plain: true });
    };
    container.addEventListener('click', onClick);
    return () => container.removeEventListener('click', onClick);
  }, [navigate]);

  let detailScreen: ReactNode = null;
  if (state && detailLocation) {
    let detailTitle: string | undefined;
    let detailStoryIds: string[] | undefined;

    if (detailLocation.kind === 'collection') {
      const collection = state.collections[detailLocation.collectionIndex];
      if (collection) {
        detailTitle = collection.title;
        detailStoryIds = collection.storyIds;
      }
    } else {
      const grouped = groupStoriesByComponent(state.collections);
      const targetStoryId = detailLocation.storyId;
      const group = grouped.find(
        (candidate) => targetStoryId !== undefined && candidate.storyIds.includes(targetStoryId)
      );
      if (group) {
        detailStoryIds = group.storyIds;
        detailTitle = storyInfo[group.storyIds[0]]?.title ?? prettifyComponentId(group.componentId);
      }
    }

    if (detailTitle !== undefined && detailStoryIds && detailStoryIds.length > 0) {
      const totalStories = detailStoryIds.length;
      const resolvedIndexFromStoryId =
        detailLocation.storyId !== undefined
          ? detailStoryIds.findIndex((storyId) => storyId === detailLocation.storyId)
          : -1;
      const currentStoryIndex = resolvedIndexFromStoryId >= 0 ? resolvedIndexFromStoryId : 0;
      const previousStoryIndex = (currentStoryIndex - 1 + totalStories) % totalStories;
      const nextStoryIndex = (currentStoryIndex + 1) % totalStories;

      const previousStoryId = detailStoryIds[previousStoryIndex];
      const nextStoryId = detailStoryIds[nextStoryIndex];
      const currentStoryId = detailStoryIds[currentStoryIndex];
      const currentStoryInfo = storyInfo[currentStoryId];
      detailScreen = React.createElement(DetailsScreen, {
        title: detailTitle,
        storyId: currentStoryId,
        storyIndex: currentStoryIndex,
        totalStories,
        componentTitle: currentStoryInfo?.title,
        storyName: currentStoryInfo?.name,
        backHref: buildReviewChangesSummaryHref(activeTab),
        previousHref: buildReviewChangesDetailHref(
          detailLocation.kind === 'collection'
            ? {
                kind: 'collection',
                collectionIndex: detailLocation.collectionIndex,
                storyId: previousStoryId,
              }
            : {
                kind: 'component',
                storyId: previousStoryId,
              },
          activeTab
        ),
        nextHref: buildReviewChangesDetailHref(
          detailLocation.kind === 'collection'
            ? {
                kind: 'collection',
                collectionIndex: detailLocation.collectionIndex,
                storyId: nextStoryId,
              }
            : {
                kind: 'component',
                storyId: nextStoryId,
              },
          activeTab
        ),
        branchName: state.branchName,
      });
    }
  }

  const hasDetailScreen = detailScreen !== null;

  return React.createElement(
    'div',
    { ref: containerRef, style: { display: 'contents' } },
    React.createElement(
      'div',
      { style: { position: 'relative', height: '100dvh' } },
      React.createElement(
        'div',
        {
          'aria-hidden': hasDetailScreen || undefined,
          inert: hasDetailScreen || undefined,
          style: hasDetailScreen ? { pointerEvents: 'none' } : undefined,
        },
        React.createElement(SummaryScreen, {
          state,
          initialTab: activeTab,
          onTabChange: (nextTab: ReviewTab) => {
            navigate(buildReviewChangesSummaryHref(nextTab), { plain: true });
          },
          storyInfo,
        })
      ),
      hasDetailScreen
        ? React.createElement(
            'div',
            { style: { position: 'absolute', inset: 0, zIndex: 1 } },
            detailScreen
          )
        : null
    )
  );
};
