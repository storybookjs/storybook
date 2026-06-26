import {
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
import { AUTO_ENTERED_SESSION_KEY, EVENTS, PRE_REVIEW_RETURN_KEY } from './constants.ts';
import { navigateOutOfReview } from './review-actions.ts';
import { enterReviewMode, exitReviewMode, isReviewModeActive } from './review-mode.ts';
import {
  REVIEW_COLLECTION_QUERY_PARAM,
  buildFlattenedNavEntries,
  buildReviewChangesSummaryHref,
  isReviewLayoutActive,
  isReviewReturnSearch,
  isReviewRoute,
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
import { useReviewFiltersRef } from './useReviewFiltersRef.ts';

const reviewStatusStore = experimental_getStatusStore(REVIEW_STATUS_TYPE_ID);

const isDeferredReviewUpdate = (current: ReviewState | null, next: ReviewState): boolean =>
  current !== null &&
  current.createdAt !== undefined &&
  next.createdAt !== undefined &&
  current.createdAt !== next.createdAt;

export const ReviewProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ReviewState | null>(null);
  const [pendingReview, setPendingReview] = useState<ReviewState | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [isInReviewMode, setIsInReviewMode] = useState(() => isReviewModeActive());
  const previousReviewStoryIdsRef = useRef<Set<string>>(new Set());
  const displayedReviewRef = useRef<ReviewState | null>(null);
  const replayExpectedRef = useRef(true);
  const routeRef = useRef({ path: '/', collectionParam: undefined as string | undefined });
  displayedReviewRef.current = state;

  const api = useStorybookApi();
  const navigate = useNavigate();
  const { index, path, viewMode, customQueryParams, location } = useStorybookState();

  const collectionParam = customQueryParams?.[REVIEW_COLLECTION_QUERY_PARAM] as string | undefined;
  routeRef.current = { path, collectionParam };

  // Current sidebar filters, snapshotted by enterReviewMode and restored on exit.
  const filtersRef = useReviewFiltersRef();

  const enterReview = useCallback(() => {
    void enterReviewMode(api, filtersRef.current);
    setIsInReviewMode(true);
  }, [api, filtersRef]);

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

      const isReplay = replayExpectedRef.current;
      replayExpectedRef.current = false;
      const { path: currentPath, collectionParam: currentCollection } = routeRef.current;
      if (!isReplay && !isReviewRoute(currentPath, currentCollection)) {
        navigate(buildReviewChangesSummaryHref(), { plain: true });
      }
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
    replayExpectedRef.current = true;
    emit(EVENTS.REQUEST_REVIEW);
    const timer = globalThis.setTimeout(() => {
      replayExpectedRef.current = false;
    }, 500);
    return () => globalThis.clearTimeout(timer);
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
        if (isChangeDetectedNew(storyId)) {
          ids.add(storyId);
        }
      }
    }
    return ids;
  }, [allStatuses, state]);

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

  // Keep review chrome/filters in sync with `full=1` and review routes in the URL.
  useEffect(() => {
    if (!isReviewRoute(path, collectionParam)) {
      reviewStore.releaseUrlSyncSuppression();
    }
    if (reviewStore.isUrlSyncSuppressed()) {
      return;
    }

    const reviewRoute = isReviewRoute(path, collectionParam);
    const fullActive = isReviewLayoutActive(location);
    const reviewModeActive = isReviewModeActive();

    if (reviewRoute && !fullActive) {
      if (isSummaryVisible && !reviewModeActive) {
        api.applyQueryParams({ full: '1' }, { replace: true });
        return;
      }
      if (reviewModeActive) {
        void exitReviewMode(api);
        setIsInReviewMode(false);
      }
      return;
    }

    if (reviewRoute && fullActive) {
      if (!isReviewModeActive()) {
        void enterReviewMode(api, filtersRef.current);
      }
      setIsInReviewMode(true);
      return;
    }

    if (isReviewModeActive()) {
      void exitReviewMode(api);
      setIsInReviewMode(false);
    } else {
      setIsInReviewMode(false);
    }
  }, [api, collectionParam, filtersRef, isSummaryVisible, location, path]);

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
      getStoryPreviewHref,
      dismissReview,
    ]
  );

  // Sync before paint so toolbar surfaces read current route on first frame.
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

export const isReviewPath = (path: string): boolean => isReviewSummaryPath(path);
