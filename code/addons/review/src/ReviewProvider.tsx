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
  type ReviewModeFilters,
  enterReviewMode,
  experimental_getStatusStore,
  experimental_useStatusStore,
  isReviewModeActive,
  useChannel,
  useStorybookApi,
  useStorybookState,
} from 'storybook/manager-api';
import { useNavigate } from 'storybook/internal/router';
import type { StatusValue, StatusesByStoryIdAndTypeId } from 'storybook/internal/types';
import { CHANGE_DETECTION_STATUS_TYPE_ID, REVIEW_STATUS_TYPE_ID } from 'storybook/internal/types';

import {
  fallbackStoryInfo,
  type StoryChangeStatus,
  type StoryInfo,
} from './components/CollectionGrid.tsx';
import {
  AUTO_ENTERED_SESSION_KEY,
  BASELINE_INDEX_URL,
  DEFAULT_COMPARE_MODE,
  EVENTS,
  PREVIEW_MODE_SESSION_KEY,
  PRE_REVIEW_RETURN_KEY,
  REVIEW_CHANGES_URL,
  type CompareMode,
} from './constants.ts';
import { navigateOutOfReview } from './review-actions.ts';
import {
  REVIEW_COLLECTION_QUERY_PARAM,
  buildFlattenedNavEntries,
  buildReviewChangesSummaryHref,
  isReviewReturnSearch,
  isReviewSummaryPath,
  parseCollectionIndex,
  parseStoryIdFromPath,
  resolveActiveNavEntry,
  resolveNavIndex,
} from './review-navigation.ts';
import type { ReviewState } from './review-state.ts';
import { reviewStore, type ReviewStoreState } from './review-store.ts';
import { clearReviewStatuses, collectReviewStoryIds, syncReviewStatuses } from './review-status.ts';
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

const isDeferredReviewUpdate = (current: ReviewState | null, next: ReviewState): boolean =>
  current !== null &&
  current.createdAt !== undefined &&
  next.createdAt !== undefined &&
  current.createdAt !== next.createdAt;

export const ReviewProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ReviewState | null>(null);
  const [pendingReview, setPendingReview] = useState<ReviewState | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [baselineStoryIds, setBaselineStoryIds] = useState<Set<string> | null>(null);
  const [compareMode, setCompareModeState] = useState<CompareMode>(readCompareMode);
  const [isInReviewMode, setIsInReviewMode] = useState(() => isReviewModeActive());
  const previousReviewStoryIdsRef = useRef<Set<string>>(new Set());
  const displayedReviewRef = useRef<ReviewState | null>(null);
  displayedReviewRef.current = state;

  const api = useStorybookApi();
  const navigate = useNavigate();
  const {
    index,
    path,
    viewMode,
    customQueryParams,
    location,
    includedStatusFilters,
    excludedStatusFilters,
    includedTagFilters,
    excludedTagFilters,
  } = useStorybookState();

  const collectionParam = customQueryParams?.[REVIEW_COLLECTION_QUERY_PARAM] as string | undefined;

  // Current sidebar filters, snapshotted by enterReviewMode and restored on exit.
  const filtersRef = useRef<ReviewModeFilters>({
    includedStatusFilters: [],
    excludedStatusFilters: [],
    includedTagFilters: [],
    excludedTagFilters: [],
  });
  filtersRef.current = {
    includedStatusFilters: (includedStatusFilters ?? []) as StatusValue[],
    excludedStatusFilters: (excludedStatusFilters ?? []) as StatusValue[],
    includedTagFilters: includedTagFilters ?? [],
    excludedTagFilters: excludedTagFilters ?? [],
  };

  const enterReview = useCallback(() => {
    void enterReviewMode(api, filtersRef.current);
    setIsInReviewMode(true);
  }, [api]);

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
      const current = displayedReviewRef.current;
      if (isDeferredReviewUpdate(current, next)) {
        setPendingReview(next);
        return;
      }
      setPendingReview(null);
      // A fresh payload re-arms the one-time auto-enter.
      sessionStore.remove(AUTO_ENTERED_SESSION_KEY);
      setState(next);
      setIsStale(!!next.stale);
    },
    [EVENTS.REVIEW_STALE]: () => {
      setIsStale(true);
    },
    [EVENTS.REVIEW_DISMISSED]: (returnSearch?: string | null) => {
      clearReviewStatuses(reviewStatusStore);
      previousReviewStoryIdsRef.current = new Set();
      sessionStore.remove(AUTO_ENTERED_SESSION_KEY);
      setState(null);
      setPendingReview(null);
      setIsStale(false);
      setBaselineStoryIds(null);
      setIsInReviewMode(false);
      navigateOutOfReview(api, navigate, returnSearch);
    },
  });

  const dismissReview = useCallback(() => {
    const returnSearch = sessionStore.read(PRE_REVIEW_RETURN_KEY);
    emit(EVENTS.DISMISS_REVIEW, returnSearch);
  }, [emit]);

  const acceptPendingReview = useCallback(() => {
    if (!pendingReview) {
      return;
    }
    setState(pendingReview);
    setIsStale(!!pendingReview.stale);
    setPendingReview(null);
    sessionStore.remove(AUTO_ENTERED_SESSION_KEY);
    enterReview();
    navigate(buildReviewChangesSummaryHref(), { plain: true });
  }, [enterReview, navigate, pendingReview]);

  useEffect(() => {
    emit(EVENTS.REQUEST_REVIEW);
  }, [emit]);

  // Tag every story in the active review so the sidebar shows reviewing status
  // and the Quick review widget can count them. Filtering is owned by review mode.
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
  }, [state]);

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
          isNewlyAdded: newlyAddedStoryIds.has(storyId) || undefined,
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

  const collectionIndex = parseCollectionIndex(collectionParam);
  const storyIdFromPath = parseStoryIdFromPath(path);
  const activeEntry =
    state && storyIdFromPath
      ? resolveActiveNavEntry(flattenedEntries, storyIdFromPath, collectionIndex)
      : null;
  const activeIndex = activeEntry ? resolveNavIndex(flattenedEntries, activeEntry) : -1;

  const isSummaryVisible = isReviewSummaryPath(path);

  const showCompare =
    baselineStoryIds !== null &&
    activeEntry !== null &&
    !newlyAddedStoryIds.has(activeEntry.storyId);

  // Re-sync the persisted review-mode flag on every navigation. Enter/exit
  // performed by the nav interceptor and shortcuts toggle it out of band before
  // navigating, so a route change is the signal to re-read it.
  useEffect(() => {
    setIsInReviewMode(isReviewModeActive());
  }, [path, collectionParam]);

  // First landing on the summary with a clean, newly available review enters
  // review mode once. Deduplicated so reloads and post-exit returns don't re-enter.
  useEffect(() => {
    if (!state || !isSummaryVisible || isReviewModeActive()) {
      return;
    }
    if (sessionStore.read(AUTO_ENTERED_SESSION_KEY) === '1') {
      return;
    }
    sessionStore.write(AUTO_ENTERED_SESSION_KEY, '1');
    enterReview();
  }, [state, isSummaryVisible, enterReview]);

  // Remember the last canvas search outside review mode so leaving review can
  // return to the pre-review canvas (both summary back and dismiss).
  useEffect(() => {
    if (isInReviewMode) {
      return;
    }
    if (viewMode !== 'story' && viewMode !== 'docs') {
      return;
    }
    const search = location?.search;
    if (search && !isReviewReturnSearch(search)) {
      sessionStore.write(PRE_REVIEW_RETURN_KEY, search);
    }
  }, [isInReviewMode, viewMode, location?.search]);

  const value = useMemo<ReviewStoreState>(
    () => ({
      state,
      isStale,
      hasPendingUpdate: pendingReview !== null,
      onAcceptPendingUpdate: acceptPendingReview,
      storyInfo,
      flattenedEntries,
      newlyAddedStoryIds,
      activeEntry,
      activeIndex,
      isInReviewMode,
      isSummaryVisible,
      compareMode,
      setCompareMode,
      showCompare,
      getStoryPreviewHref,
      dismissReview,
    }),
    [
      state,
      isStale,
      pendingReview,
      acceptPendingReview,
      storyInfo,
      flattenedEntries,
      newlyAddedStoryIds,
      activeEntry,
      activeIndex,
      isInReviewMode,
      isSummaryVisible,
      compareMode,
      setCompareMode,
      showCompare,
      getStoryPreviewHref,
      dismissReview,
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
