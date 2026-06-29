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
import {
  AUTO_ENTERED_SESSION_KEY,
  EVENTS,
  PRE_REVIEW_RETURN_KEY,
  REVIEW_CHANGES_URL,
} from './constants.ts';
import { enterReviewMode, isReviewModeActive } from './review-mode.ts';
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
import {
  clearReviewProgress,
  countReviewed,
  readReviewProgress,
  reviewEntryKey,
  writeReviewProgress,
} from './review-progress.ts';
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
  const [reviewedStoryIds, setReviewedStoryIds] = useState<Set<string>>(() => new Set());
  const [justCompletedEntryKey, setJustCompletedEntryKey] = useState<string | null>(null);
  const previousReviewStoryIdsRef = useRef<Set<string>>(new Set());
  const displayedReviewRef = useRef<ReviewState | null>(null);
  displayedReviewRef.current = state;

  // Reset reviewed-progress synchronously when the displayed review changes
  // identity (new payload, accepted update, or dismissal). Keying off the
  // displayed `createdAt` means deferred pushes — which only set pendingReview —
  // never reset progress; only first display or accepting an update does.
  const progressKeyRef = useRef<string | undefined>(undefined);
  const progressKey = state ? `created:${state.createdAt ?? 'none'}` : undefined;
  if (progressKey !== progressKeyRef.current) {
    progressKeyRef.current = progressKey;
    setReviewedStoryIds(state ? readReviewProgress(state.createdAt) : new Set());
    setJustCompletedEntryKey(null);
  }

  const api = useStorybookApi();
  const navigate = useNavigate();
  const { index, path, viewMode, customQueryParams, location } = useStorybookState();

  const collectionParam = customQueryParams?.[REVIEW_COLLECTION_QUERY_PARAM] as string | undefined;

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
    },
    [EVENTS.REVIEW_STALE]: () => {
      setIsStale(true);
    },
    [EVENTS.REVIEW_DISMISSED]: (returnSearch?: string | null) => {
      clearReviewStatuses(reviewStatusStore);
      clearReviewProgress(displayedReviewRef.current?.createdAt);
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

  const reviewStoryIds = useMemo(
    () => (state ? collectReviewStoryIds(state) : new Set<string>()),
    [state]
  );
  const reviewedCount = useMemo(
    () => countReviewed(reviewedStoryIds, reviewStoryIds),
    [reviewedStoryIds, reviewStoryIds]
  );
  const totalReviewCount = reviewStoryIds.size;

  // Mark-on-arrival: the active review story counts as reviewed the moment its
  // screen resolves (covers Next/Prev, picker, thumbnail, shortcut, reload). The
  // arrival that flips the set from incomplete to complete records a one-shot
  // "just completed" key so the toolbar can offer Done while staying on it; the
  // key clears as soon as the active entry changes (including back to summary).
  const activeStoryId = activeEntry?.storyId;
  const activeCollectionIndex = activeEntry?.collectionIndex;
  useEffect(() => {
    if (!state || activeStoryId === undefined || activeCollectionIndex === undefined) {
      setJustCompletedEntryKey(null);
      return;
    }
    const key = reviewEntryKey({ storyId: activeStoryId, collectionIndex: activeCollectionIndex });
    if (reviewedStoryIds.has(activeStoryId)) {
      setJustCompletedEntryKey((previous) => (previous === key ? previous : null));
      return;
    }
    const next = new Set(reviewedStoryIds).add(activeStoryId);
    const before = countReviewed(reviewedStoryIds, reviewStoryIds);
    const after = countReviewed(next, reviewStoryIds);
    setReviewedStoryIds(next);
    writeReviewProgress(state.createdAt, next);
    setJustCompletedEntryKey(before < totalReviewCount && after === totalReviewCount ? key : null);
  }, [
    state,
    activeStoryId,
    activeCollectionIndex,
    reviewedStoryIds,
    reviewStoryIds,
    totalReviewCount,
  ]);

  const isSummaryVisible = isReviewSummaryPath(path);

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
      getStoryPreviewHref,
      dismissReview,
      reviewedStoryIds,
      reviewedCount,
      totalReviewCount,
      justCompletedEntryKey,
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
      reviewedStoryIds,
      reviewedCount,
      totalReviewCount,
      justCompletedEntryKey,
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

export const isReviewPath = (path: string): boolean =>
  isReviewSummaryPath(path) || path.startsWith(REVIEW_CHANGES_URL);
