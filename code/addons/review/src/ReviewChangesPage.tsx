import React, { type FC, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import { useChannel, useStorybookApi, useStorybookState } from 'storybook/manager-api';
import { Location, useNavigate } from 'storybook/internal/router';

import type { StoryInfo } from './components/CollectionGrid.tsx';
import { EVENTS, RESTORE_NAV_SESSION_KEY, REVIEW_CHANGES_URL } from './constants.ts';
import { groupStoriesByComponent, prettifyComponentId } from './review-grouping.ts';
import {
  buildReviewChangesDetailHref,
  buildReviewChangesSummaryHref,
  parseReviewChangesActiveTab,
  parseReviewChangesDetailLocation,
} from './review-navigation.ts';
import type { ReviewState } from './review-state.ts';
import { DetailsScreen } from './screens/DetailsScreen.tsx';
import { SummaryScreen } from './screens/SummaryScreen.tsx';

// Reading `location.search` from the router (rather than window.location)
// makes the page re-render on every in-page navigation, so the detail screen
// can swap stories without a manager reload.
export const ReviewChangesPage: FC = () => (
  <Location>{({ location }) => <ReviewChangesContent search={location.search ?? ''} />}</Location>
);

const ReviewChangesContent: FC<{ search: string }> = ({ search }) => {
  const [state, setState] = useState<ReviewState | null>(null);

  const api = useStorybookApi();
  const { index } = useStorybookState();
  const navigate = useNavigate();

  const emit = useChannel({
    [EVENTS.APPLY_REVIEW_STATE]: (next: ReviewState) => setState(next),
  });

  // Late/refreshed tab: ask the server to replay the cached overlay.
  useEffect(() => {
    emit(EVENTS.REQUEST_REVIEW_STATE);
  }, [emit]);

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
      const anchor = (event.target as HTMLElement | null)?.closest('a');
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

  const activeTab = parseReviewChangesActiveTab(search);
  const detailLocation = parseReviewChangesDetailLocation(search);

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
      const group = groupStoriesByComponent(state.collections).find(
        (candidate) => candidate.componentId === detailLocation.componentId
      );
      if (group) {
        detailStoryIds = group.storyIds;
        detailTitle = storyInfo[group.storyIds[0]]?.title ?? prettifyComponentId(group.componentId);
      }
    }

    if (detailTitle !== undefined && detailStoryIds && detailStoryIds.length > 0) {
      const totalStories = detailStoryIds.length;
      const currentStoryIndex = detailLocation.storyIndex % totalStories;
      const previousStoryIndex = (currentStoryIndex - 1 + totalStories) % totalStories;
      const nextStoryIndex = (currentStoryIndex + 1) % totalStories;

      detailScreen = (
        <DetailsScreen
          title={detailTitle}
          storyId={detailStoryIds[currentStoryIndex]}
          storyIndex={currentStoryIndex}
          totalStories={totalStories}
          backHref={buildReviewChangesSummaryHref(activeTab)}
          previousHref={buildReviewChangesDetailHref(
            { ...detailLocation, storyIndex: previousStoryIndex },
            activeTab
          )}
          nextHref={buildReviewChangesDetailHref(
            { ...detailLocation, storyIndex: nextStoryIndex },
            activeTab
          )}
          branchName={state.branchName}
        />
      );
    }
  }

  return (
    <div ref={containerRef} style={{ display: 'contents' }}>
      {detailScreen ?? <SummaryScreen state={state} initialTab={activeTab} storyInfo={storyInfo} />}
    </div>
  );
};
