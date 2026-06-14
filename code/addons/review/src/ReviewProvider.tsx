import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from 'react';

import {
  experimental_getStatusStore,
  experimental_useStatusStore,
  useChannel,
  useStorybookApi,
  useStorybookState,
} from 'storybook/manager-api';
import { useNavigate } from 'storybook/internal/router';
import type { StatusesByStoryIdAndTypeId } from 'storybook/internal/types';
import { CHANGE_DETECTION_STATUS_TYPE_ID, REVIEW_STATUS_TYPE_ID } from 'storybook/internal/types';

import {
  fallbackStoryInfo,
  type StoryChangeStatus,
  type StoryInfo,
} from './components/CollectionGrid.tsx';
import {
  BASELINE_INDEX_URL,
  DEFAULT_COMPARE_MODE,
  EVENTS,
  PREVIEW_MODE_SESSION_KEY,
  LAST_REVIEWED_STORY_SESSION_KEY,
  RESTORE_NAV_SESSION_KEY,
  RETURN_PATH_SESSION_KEY,
  REVIEW_CHANGES_URL,
  type CompareMode,
} from './constants.ts';
import {
  REVIEW_COLLECTION_QUERY_PARAM,
  buildFlattenedNavEntries,
  isReviewSessionPath,
  isReviewSummaryPath,
  isStoryInReview,
  parseCollectionIndex,
  parseStoryIdFromPath,
  resolveActiveNavEntry,
  resolveNavIndex,
  type ReviewNavEntry,
} from './review-navigation.ts';
import type { ReviewState } from './review-state.ts';
import { reviewStore, type ReviewStoreState } from './review-store.ts';
import {
  REVIEWING_STATUS_VALUE,
  clearReviewStatuses,
  collectReviewStoryIds,
  syncReviewStatuses,
} from './review-status.ts';
import { setReviewStatusFilters } from './review-status-filters.ts';
import { sessionStore } from './session-store.ts';

const reviewStatusStore = experimental_getStatusStore(REVIEW_STATUS_TYPE_ID);

const readCompareMode = (): CompareMode => {
  const stored = sessionStore.read(PREVIEW_MODE_SESSION_KEY);
  if (stored === 'split' || stored === 'baseline' || stored === 'latest') {
    return stored;
  }
  // Migrate legacy detail-screen values.
  if (stored === '2up') {
    return 'split';
  }
  return DEFAULT_COMPARE_MODE;
};

const isReviewReturnSearch = (search: string) => {
  const path =
    new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('path') ?? '';
  return isReviewSummaryPath(path) || path.startsWith(REVIEW_CHANGES_URL);
};

/** Transient flag on DISPLAY_REVIEW after PUSH_REVIEW; not part of cached ReviewState. */
type ReviewDisplayEvent = ReviewState & { collapseNavOnOpen?: boolean };

export const ReviewProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ReviewState | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [baselineStoryIds, setBaselineStoryIds] = useState<Set<string> | null>(null);
  const [compareMode, setCompareModeState] = useState<CompareMode>(readCompareMode);
  const [lastReviewedStoryHref, setLastReviewedStoryHref] = useState<string | null>(() =>
    sessionStore.read(LAST_REVIEWED_STORY_SESSION_KEY)
  );
  const [pendingNavCollapse, setPendingNavCollapse] = useState(false);
  const previousReviewStoryIdsRef = useRef<Set<string>>(new Set());

  const api = useStorybookApi();
  const navigate = useNavigate();
  const { index, path, viewMode, customQueryParams, location } = useStorybookState();

  const setCompareMode = useCallback((mode: CompareMode) => {
    setCompareModeState(mode);
    sessionStore.write(PREVIEW_MODE_SESSION_KEY, mode);
  }, []);

  const getStoryPreviewHref = useCallback(
    (storyId: string) => api.getStoryHrefs(storyId, { freeze: true }).previewHref,
    [api]
  );

  const navigateToReturn = useCallback(
    (returnSearch?: string | null) => {
      api.setQueryParams({ [REVIEW_COLLECTION_QUERY_PARAM]: null });
      reviewStore.releaseSummaryOverlaySuppression();

      const target = returnSearch ?? sessionStore.read(RETURN_PATH_SESSION_KEY);
      sessionStore.remove(RETURN_PATH_SESSION_KEY);

      if (target && !isReviewReturnSearch(target)) {
        navigate(target.startsWith('?') ? target : `?${target}`, { plain: true });
        return;
      }

      api.selectFirstStory();
    },
    [api, navigate]
  );

  const emit = useChannel({
    [EVENTS.DISPLAY_REVIEW]: (next: ReviewDisplayEvent) => {
      const { collapseNavOnOpen, ...review } = next;
      setState(review);
      setIsStale(!!review.stale);
      if (collapseNavOnOpen) {
        setPendingNavCollapse(true);
      }
    },
    [EVENTS.REVIEW_STALE]: () => {
      setIsStale(true);
    },
    [EVENTS.REVIEW_DISMISSED]: (returnSearch?: string | null) => {
      clearReviewStatuses(reviewStatusStore);
      previousReviewStoryIdsRef.current = new Set();
      void setReviewStatusFilters(api, [], []);
      setState(null);
      setIsStale(false);
      setBaselineStoryIds(null);
      navigateToReturn(returnSearch);
    },
  });

  const dismissReview = useCallback(() => {
    const returnSearch = sessionStore.read(RETURN_PATH_SESSION_KEY);
    emit(EVENTS.DISMISS_REVIEW, returnSearch);
  }, [emit]);

  useEffect(() => {
    emit(EVENTS.REQUEST_REVIEW);
  }, [emit]);

  // Tag every story in the active review and filter the sidebar to them only.
  useEffect(() => {
    if (!state) {
      return;
    }

    const storyIds = collectReviewStoryIds(state);
    previousReviewStoryIdsRef.current = syncReviewStatuses(
      reviewStatusStore,
      storyIds,
      previousReviewStoryIdsRef.current
    );
    void setReviewStatusFilters(api, [REVIEWING_STATUS_VALUE], []);
  }, [api, state?.createdAt]);

  const reviewCreatedAt = state?.createdAt;
  useEffect(() => {
    if (reviewCreatedAt === undefined || !state?.hasBaseline) {
      setBaselineStoryIds(null);
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
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [reviewCreatedAt, state?.hasBaseline]);

  const flattenedEntries = useMemo(() => (state ? buildFlattenedNavEntries(state) : []), [state]);

  const allStatuses = experimental_useStatusStore() as StatusesByStoryIdAndTypeId;
  const newlyAddedStoryIds = useMemo(() => {
    const ids = new Set<string>();
    if (!state) {
      return ids;
    }
    const isChangeDetectedNew = (storyId: string) =>
      Object.values(allStatuses[storyId] ?? {}).some(
        (status) => status.value === 'status-value:new'
      );
    for (const collection of state.collections) {
      for (const storyId of collection.storyIds) {
        const absentFromBaseline = baselineStoryIds !== null && !baselineStoryIds.has(storyId);
        if (isChangeDetectedNew(storyId) || absentFromBaseline) {
          ids.add(storyId);
        }
      }
    }
    return ids;
  }, [allStatuses, baselineStoryIds, state]);

  const storyInfo = useMemo(() => {
    const info: Record<string, StoryInfo> = {};
    if (!state) {
      return info;
    }
    const getStoryChangeStatus = (storyId: string): StoryChangeStatus | undefined => {
      const changeValue = Object.values(allStatuses[storyId] ?? {}).find(
        (status) => status.typeId === CHANGE_DETECTION_STATUS_TYPE_ID
      )?.value;
      if (changeValue === 'status-value:new') {
        return 'new';
      }
      if (changeValue === 'status-value:modified') {
        return 'modified';
      }
      return undefined;
    };
    for (const collection of state.collections) {
      for (const storyId of collection.storyIds) {
        if (storyId in info) {
          continue;
        }
        const direct = index?.[storyId];
        const entry =
          direct?.type === 'story' ? direct : index ? api.findLeafEntry(index, storyId) : undefined;
        const shared = {
          isNew: newlyAddedStoryIds.has(storyId) || undefined,
          changeStatus: getStoryChangeStatus(storyId),
        };
        if (entry?.type === 'story' && entry.title) {
          info[storyId] = {
            title: entry.title,
            name: entry.name,
            ...shared,
          };
        } else {
          info[storyId] = {
            ...fallbackStoryInfo(storyId),
            ...shared,
          };
        }
      }
    }
    return info;
  }, [allStatuses, api, index, newlyAddedStoryIds, state]);

  const collectionParam = customQueryParams?.[REVIEW_COLLECTION_QUERY_PARAM] as string | undefined;
  const collectionIndex = parseCollectionIndex(collectionParam);
  const storyIdFromPath = parseStoryIdFromPath(path);
  const activeEntry =
    state && storyIdFromPath
      ? resolveActiveNavEntry(flattenedEntries, storyIdFromPath, collectionIndex)
      : null;
  const activeIndex = activeEntry ? resolveNavIndex(flattenedEntries, activeEntry) : -1;

  const isSummaryVisible = isReviewSummaryPath(path);
  const isOnReviewedStory =
    viewMode === 'story' &&
    storyIdFromPath !== null &&
    isStoryInReview(flattenedEntries, storyIdFromPath);
  const isInReviewSession = isReviewSessionPath(path, collectionIndex) || isOnReviewedStory;

  const showCompare =
    baselineStoryIds !== null &&
    activeEntry !== null &&
    !newlyAddedStoryIds.has(activeEntry.storyId);

  // Remember the last story or docs URL visited so the summary back button can return there.
  useEffect(() => {
    if (isSummaryVisible) {
      return;
    }
    if (viewMode !== 'story' && viewMode !== 'docs') {
      return;
    }
    const search = location?.search;
    if (search && !isReviewReturnSearch(search)) {
      sessionStore.write(LAST_REVIEWED_STORY_SESSION_KEY, search);
      setLastReviewedStoryHref(search);
    }
  }, [isSummaryVisible, viewMode, location?.search]);

  // Remember the last canvas URL outside a review session so dismiss can return there.
  useEffect(() => {
    if (isInReviewSession) {
      return;
    }
    if (viewMode !== 'story' && viewMode !== 'docs') {
      return;
    }
    const search = location?.search;
    if (search && !isReviewReturnSearch(search)) {
      sessionStore.write(RETURN_PATH_SESSION_KEY, search);
    }
  }, [isInReviewSession, viewMode, location?.search]);

  // Collapse the sidebar the first time a freshly pushed review summary is opened.
  useEffect(() => {
    if (!isSummaryVisible || !pendingNavCollapse) {
      return;
    }
    if (sessionStore.read(RESTORE_NAV_SESSION_KEY) === null) {
      sessionStore.write(RESTORE_NAV_SESSION_KEY, api.getIsNavShown() ? 'restore' : 'keep');
    }
    api.toggleNav(false);
    setPendingNavCollapse(false);
  }, [api, isSummaryVisible, pendingNavCollapse]);

  // Restore the sidebar when leaving the review session if we collapsed it on entry.
  useEffect(() => {
    if (isInReviewSession) {
      return;
    }
    if (sessionStore.read(RESTORE_NAV_SESSION_KEY) === 'restore') {
      api.toggleNav(true);
    }
    sessionStore.remove(RESTORE_NAV_SESSION_KEY);
  }, [api, isInReviewSession]);

  const value = useMemo<ReviewStoreState>(
    () => ({
      state,
      isStale,
      storyInfo,
      flattenedEntries,
      newlyAddedStoryIds,
      activeEntry,
      activeIndex,
      isInReviewSession,
      isSummaryVisible,
      compareMode,
      setCompareMode,
      showCompare,
      getStoryPreviewHref,
      dismissReview,
      lastReviewedStoryHref,
    }),
    [
      state,
      isStale,
      storyInfo,
      flattenedEntries,
      newlyAddedStoryIds,
      activeEntry,
      activeIndex,
      isInReviewSession,
      isSummaryVisible,
      compareMode,
      setCompareMode,
      showCompare,
      getStoryPreviewHref,
      dismissReview,
      lastReviewedStoryHref,
    ]
  );

  // Sync before paint so toolbar/compare surfaces read current route on first frame.
  useLayoutEffect(() => {
    reviewStore.setState(value);
  }, [value]);

  useLayoutEffect(() => {
    if (isSummaryVisible) {
      reviewStore.releaseSummaryOverlaySuppression();
    }
  }, [isSummaryVisible]);

  return children;
};

export const isReviewPath = (path: string): boolean =>
  isReviewSummaryPath(path) || path.startsWith(REVIEW_CHANGES_URL);
