import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type FC,
  type ReactNode,
} from 'react';

import {
  experimental_useStatusStore,
  useChannel,
  useStorybookApi,
  useStorybookState,
} from 'storybook/manager-api';
import type { StatusesByStoryIdAndTypeId } from 'storybook/internal/types';

import type { StoryInfo } from './components/CollectionGrid.tsx';
import {
  BASELINE_INDEX_URL,
  DEFAULT_COMPARE_MODE,
  EVENTS,
  PREVIEW_MODE_SESSION_KEY,
  RESTORE_NAV_SESSION_KEY,
  REVIEW_CHANGES_URL,
  type CompareMode,
} from './constants.ts';
import {
  REVIEW_COLLECTION_QUERY_PARAM,
  buildFlattenedNavEntries,
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
import { sessionStore } from './session-store.ts';

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

export const ReviewProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ReviewState | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [baselineStoryIds, setBaselineStoryIds] = useState<Set<string> | null>(null);
  const [compareMode, setCompareModeState] = useState<CompareMode>(readCompareMode);

  const api = useStorybookApi();
  const { index, path, viewMode, customQueryParams } = useStorybookState();

  const setCompareMode = useCallback((mode: CompareMode) => {
    setCompareModeState(mode);
    sessionStore.write(PREVIEW_MODE_SESSION_KEY, mode);
  }, []);

  const getStoryPreviewHref = useCallback(
    (storyId: string) => api.getStoryHrefs(storyId, { freeze: true }).previewHref,
    [api]
  );

  const emit = useChannel({
    [EVENTS.DISPLAY_REVIEW]: (next: ReviewState) => {
      setState(next);
      setIsStale(!!next.stale);
    },
    [EVENTS.REVIEW_STALE]: () => {
      setIsStale(true);
    },
  });

  useEffect(() => {
    emit(EVENTS.REQUEST_REVIEW);
  }, [emit]);

  const reviewCreatedAt = state?.createdAt;
  useEffect(() => {
    if (reviewCreatedAt === undefined) {
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
  }, [reviewCreatedAt]);

  const flattenedEntries = useMemo(() => (state ? buildFlattenedNavEntries(state) : []), [state]);

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
  const isInReviewSession = isSummaryVisible || isOnReviewedStory;

  const showCompare =
    !!state?.hasBaseline && activeEntry !== null && !newlyAddedStoryIds.has(activeEntry.storyId);

  // Hide the sidebar on review entry; restore only when leaving the session.
  useEffect(() => {
    if (isSummaryVisible && sessionStore.read(RESTORE_NAV_SESSION_KEY) === null) {
      sessionStore.write(RESTORE_NAV_SESSION_KEY, api.getIsNavShown() ? 'restore' : 'keep');
      api.toggleNav(false);
    }
    if (!isInReviewSession) {
      if (sessionStore.read(RESTORE_NAV_SESSION_KEY) === 'restore') {
        api.toggleNav(true);
      }
      sessionStore.remove(RESTORE_NAV_SESSION_KEY);
    }
  }, [api, isInReviewSession, isSummaryVisible]);

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
    ]
  );

  // Sync before paint so toolbar/compare surfaces read current route on first frame.
  useLayoutEffect(() => {
    reviewStore.setState(value);
  }, [value]);

  return children;
};

export const isReviewPath = (path: string): boolean =>
  isReviewSummaryPath(path) || path.startsWith(REVIEW_CHANGES_URL);
