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
import { useNavigate } from 'storybook/internal/router';
import type { StatusesByStoryIdAndTypeId } from 'storybook/internal/types';

import { fallbackStoryInfo, type StoryInfo } from './components/CollectionGrid.tsx';
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
  buildReviewStoryHref,
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

const isReviewReturnSearch = (search: string) => {
  const path =
    new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('path') ?? '';
  return isReviewSummaryPath(path) || path.startsWith(REVIEW_CHANGES_URL);
};

export const ReviewProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ReviewState | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [baselineStoryIds, setBaselineStoryIds] = useState<Set<string> | null>(null);
  const [compareMode, setCompareModeState] = useState<CompareMode>(readCompareMode);
  const [lastReviewedStoryHref, setLastReviewedStoryHref] = useState<string | null>(() =>
    sessionStore.read(LAST_REVIEWED_STORY_SESSION_KEY)
  );

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
    [EVENTS.DISPLAY_REVIEW]: (next: ReviewState) => {
      setState(next);
      setIsStale(!!next.stale);
    },
    [EVENTS.REVIEW_STALE]: () => {
      setIsStale(true);
    },
    [EVENTS.REVIEW_DISMISSED]: (returnSearch?: string | null) => {
      setState(null);
      setIsStale(false);
      setBaselineStoryIds(null);
      sessionStore.remove(LAST_REVIEWED_STORY_SESSION_KEY);
      setLastReviewedStoryHref(null);
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
    for (const collection of state.collections) {
      for (const storyId of collection.storyIds) {
        if (storyId in info) {
          continue;
        }
        const direct = index?.[storyId];
        const entry =
          direct?.type === 'story' ? direct : index ? api.findLeafEntry(index, storyId) : undefined;
        if (entry?.type === 'story' && entry.title) {
          info[storyId] = {
            title: entry.title,
            name: entry.name,
            isNew: newlyAddedStoryIds.has(storyId) || undefined,
          };
        } else {
          info[storyId] = {
            ...fallbackStoryInfo(storyId),
            isNew: newlyAddedStoryIds.has(storyId) || undefined,
          };
        }
      }
    }
    return info;
  }, [api, index, newlyAddedStoryIds, state]);

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
    baselineStoryIds !== null &&
    activeEntry !== null &&
    !newlyAddedStoryIds.has(activeEntry.storyId);

  // Remember the last review story visited so the summary back button can return there.
  useEffect(() => {
    if (!isOnReviewedStory || !activeEntry) {
      return;
    }
    const href = buildReviewStoryHref(activeEntry);
    sessionStore.write(LAST_REVIEWED_STORY_SESSION_KEY, href);
    setLastReviewedStoryHref(href);
  }, [activeEntry, isOnReviewedStory]);

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
