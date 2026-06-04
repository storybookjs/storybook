import React, { type FC, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import {
  experimental_useStatusStore,
  useChannel,
  useStorybookApi,
  useStorybookState,
} from 'storybook/manager-api';
import { Location, type RenderData, useNavigate } from 'storybook/internal/router';
import type { StatusesByStoryIdAndTypeId } from 'storybook/internal/types';

import type { StoryInfo } from './components/CollectionGrid.tsx';
import { EVENTS, RESTORE_NAV_SESSION_KEY, REVIEW_CHANGES_URL } from './constants.ts';
import {
  buildReviewChangesDetailHref,
  buildReviewChangesSummaryHref,
  normalizeReviewStoryId,
  parseReviewChangesDetailLocation,
} from './review-navigation.ts';
import type { ReviewState } from './review-state.ts';
import { sessionStore } from './session-store.ts';
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

// Served through the dev-server proxy declared in `preset.ts`, pointing at the
// baseline Storybook. Used to detect stories that don't exist in the baseline.
const BASELINE_INDEX_URL = '/__review-baseline/index.json';

// Change-detection status value marking a story as newly added.
const NEW_STATUS_VALUE = 'status-value:new';

const ReviewPageContent: FC<{ search: string }> = ({ search }) => {
  const [state, setState] = useState<ReviewState | null>(null);
  // Story IDs present in the baseline Storybook's index. `null` means the
  // baseline is unresolved or unavailable (no fetch yet, network/proxy error,
  // or an unparseable index) — in which case no "New" badge is shown.
  const [baselineStoryIds, setBaselineStoryIds] = useState<Set<string> | null>(null);

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

  // Resolve which stories exist in the baseline so newly added stories can be
  // flagged. Keyed on `createdAt`: a freshly pushed review re-fetches the
  // baseline index. Any non-OK outcome leaves the set `null` (no badge).
  const reviewCreatedAt = state?.createdAt;
  useEffect(() => {
    if (reviewCreatedAt === undefined) {
      return undefined;
    }
    let cancelled = false;
    setBaselineStoryIds(null);
    fetch(BASELINE_INDEX_URL)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { entries?: Record<string, unknown>; stories?: Record<string, unknown> }) => {
        if (cancelled || !data) {
          return;
        }
        const entries = data.entries ?? data.stories;
        if (!entries || typeof entries !== 'object') {
          return;
        }
        setBaselineStoryIds(new Set(Object.keys(entries)));
      })
      .catch(() => {
        // Baseline unavailable — leave `null` so no "New" badge is shown.
      });
    return () => {
      cancelled = true;
    };
  }, [reviewCreatedAt]);

  const detailLocation = parseReviewChangesDetailLocation(search);

  // The review page is a focused, full-width surface — hide the manager
  // sidebar while it is open and restore it on the way out. The user's prior
  // sidebar state is stashed in sessionStorage so it survives the full-reload
  // navigations between review screens; the cleanup restores it when the user
  // leaves (unmount also fires on browser back/forward, which the manager
  // router handles as an SPA transition). A user who keeps the sidebar
  // collapsed by choice ('keep') is left untouched.
  useEffect(() => {
    if (sessionStore.read(RESTORE_NAV_SESSION_KEY) === null) {
      sessionStore.write(RESTORE_NAV_SESSION_KEY, api.getIsNavShown() ? 'restore' : 'keep');
    }
    api.toggleNav(false);

    return () => {
      if (sessionStore.read(RESTORE_NAV_SESSION_KEY) === 'restore') {
        api.toggleNav(true);
      }
      sessionStore.remove(RESTORE_NAV_SESSION_KEY);
    };
  }, [api]);

  // Resolve each story's component title + name from the Storybook index.
  // Drives the cell labels and the detail subtitle; falls back gracefully
  // (per-consumer) when the index has not loaded.
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

  // Stories the change-detection mechanism flagged as newly added. This is an
  // independent "New" signal from the baseline-index check: a story can be new
  // here even when a baseline exists (e.g. added on this branch).
  const allStatuses = experimental_useStatusStore() as StatusesByStoryIdAndTypeId;
  const changeDetectedNewStoryIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [storyId, statusesByType] of Object.entries(allStatuses)) {
      if (Object.values(statusesByType).some((status) => status.value === NEW_STATUS_VALUE)) {
        ids.add(storyId);
      }
    }
    return ids;
  }, [allStatuses]);

  // SPA navigation: imperatively attach a click listener to the container so
  // left-clicks on in-page review links push history and swap the iframe URL
  // without a manager reload (no flash). Real hrefs are kept for accessibility
  // / middle-click / open-in-new-tab, which fall through untouched. Done via
  // an effect rather than `onClick` on a div so `jsx-a11y/no-static-element-
  // interactions` doesn't flag the delegation root — the div isn't itself
  // interactive, it's just catching bubbled clicks from real <a> elements.
  const containerRef = useRef<HTMLDivElement>(null);
  const summaryWrapperRef = useRef<HTMLDivElement>(null);
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
    const collection = state.collections[detailLocation.collectionIndex];
    if (collection && collection.storyIds.length > 0) {
      const detailStoryIds = collection.storyIds;
      const totalStories = detailStoryIds.length;
      const resolvedIndexFromStoryId =
        detailLocation.storyId !== undefined
          ? detailStoryIds.findIndex((storyId) => storyId === detailLocation.storyId)
          : -1;
      const currentStoryIndex = resolvedIndexFromStoryId >= 0 ? resolvedIndexFromStoryId : 0;
      const previousStoryIndex = (currentStoryIndex - 1 + totalStories) % totalStories;
      const nextStoryIndex = (currentStoryIndex + 1) % totalStories;

      const currentStoryId = detailStoryIds[currentStoryIndex];
      const currentStoryInfo = storyInfo[currentStoryId];
      // A story is "New" if change-detection flagged it (regardless of any
      // baseline), or once the baseline index has resolved and confirms the
      // story is absent. While the baseline is unresolved/unavailable (`null`)
      // it contributes nothing — only the change-detection signal applies.
      const isNew =
        changeDetectedNewStoryIds.has(currentStoryId) ||
        (baselineStoryIds !== null && !baselineStoryIds.has(currentStoryId));
      detailScreen = React.createElement(DetailsScreen, {
        title: collection.title,
        storyId: currentStoryId,
        storyIndex: currentStoryIndex,
        totalStories,
        componentTitle: currentStoryInfo?.title,
        storyName: currentStoryInfo?.name,
        isNew,
        backHref: buildReviewChangesSummaryHref(),
        previousHref: buildReviewChangesDetailHref({
          collectionIndex: detailLocation.collectionIndex,
          storyId: detailStoryIds[previousStoryIndex],
        }),
        nextHref: buildReviewChangesDetailHref({
          collectionIndex: detailLocation.collectionIndex,
          storyId: detailStoryIds[nextStoryIndex],
        }),
        hasBaseline: state.hasBaseline ?? false,
      });
    }
  }

  const hasDetailScreen = detailScreen !== null;

  // While the detail screen is open the summary stays mounted behind it, but
  // must drop out of the tab order and the accessibility tree so keyboard and
  // screen-reader focus can't reach it. React 18 doesn't serialize a boolean
  // `inert` prop to the DOM, so toggle the property imperatively.
  useEffect(() => {
    const node = summaryWrapperRef.current;
    if (node) {
      node.inert = hasDetailScreen;
    }
  }, [hasDetailScreen]);

  return React.createElement(
    'div',
    { ref: containerRef, style: { display: 'contents' } },
    React.createElement(
      'div',
      { style: { position: 'relative', height: '100dvh' } },
      React.createElement(
        'div',
        {
          ref: summaryWrapperRef,
          'aria-hidden': hasDetailScreen || undefined,
          style: hasDetailScreen ? { pointerEvents: 'none' } : undefined,
        },
        React.createElement(SummaryScreen, {
          state,
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
