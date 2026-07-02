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

import { useNavigate } from 'storybook/internal/router';
import type { StatusesByStoryIdAndTypeId } from 'storybook/internal/types';
import { REVIEW_STATUS_TYPE_ID } from 'storybook/internal/types';
import {
  experimental_getStatusStore,
  experimental_useStatusStore,
  useChannel,
  useStorybookApi,
  useStorybookState,
} from 'storybook/manager-api';

import {
  AUTO_ENTERED_SESSION_KEY,
  EVENTS,
  PRE_REVIEW_RETURN_KEY,
  REVIEW_EXITING_SESSION_KEY,
} from '../constants.ts';
import { navigateOutOfReview } from '../review-actions.ts';
import { enterReviewMode, isReviewModeActive } from '../review-mode.ts';
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
} from '../review-navigation.ts';
import {
  acceptReviewNotification,
  clearReviewNotificationsOnDismiss,
} from '../review-notification.ts';
import type { ReviewState } from '../review-state.ts';
import {
  clearReviewStatuses,
  collectReviewStoryIds,
  syncReviewStatuses,
} from '../review-status.ts';
import { reviewNotificationKey, reviewStore, type ReviewStoreState } from '../review-store.ts';
import { buildNewlyAddedStoryIds, buildStoryInfo } from '../review-story-info.ts';
import { sessionStore } from '../session-store.ts';
import { useReviewFiltersRef } from '../useReviewFiltersRef.ts';

const reviewStatusStore = experimental_getStatusStore(REVIEW_STATUS_TYPE_ID);

const isDeferredReviewUpdate = (current: ReviewState | null, next: ReviewState): boolean =>
  current !== null &&
  current.createdAt !== undefined &&
  next.createdAt !== undefined &&
  current.createdAt !== next.createdAt;

const isSameReviewPayload = (current: ReviewState | null, next: ReviewState): boolean =>
  current?.createdAt !== undefined && current.createdAt === next.createdAt;

export const ReviewProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ReviewState | null>(null);
  const [pendingReview, setPendingReview] = useState<ReviewState | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [isInReviewMode, setIsInReviewMode] = useState(() => isReviewModeActive());
  const previousReviewStoryIdsRef = useRef<Set<string>>(new Set());
  const displayedReviewRef = useRef<ReviewState | null>(null);
  displayedReviewRef.current = state;
  // Last review page reported to telemetry; dedupes pageviews across re-renders.
  const lastPageviewKeyRef = useRef<string | null>(null);

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
    (storyId: string) => api.getStoryHrefs(storyId, { embed: true, freeze: true }).previewHref,
    [api]
  );

  const emit = useChannel({
    [EVENTS.DISPLAY_REVIEW]: (next: ReviewState) => {
      const current = displayedReviewRef.current;
      if (isDeferredReviewUpdate(current, next)) {
        setPendingReview(next);
        reviewStore.setState(reviewStore.getState(), next);
        return;
      }
      // REQUEST_REVIEW replays the cached payload to every tab when another tab
      // mounts; ignore identical reviews so summary UI state is not reset.
      if (isSameReviewPayload(current, next)) {
        setIsStale(!!next.stale);
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
      clearReviewNotificationsOnDismiss(
        api,
        reviewStore.getState().state,
        reviewStore.getPendingReview()
      );
      setState(null);
      setPendingReview(null);
      setIsStale(false);
      setIsInReviewMode(false);
      void navigateOutOfReview(api, navigate, returnSearch, { recordVisit: false });
    },
  });

  const dismissReview = useCallback(() => {
    const returnSearch = sessionStore.read(PRE_REVIEW_RETURN_KEY);
    emit(EVENTS.DISMISS_REVIEW, returnSearch);
  }, [emit]);

  const acceptPendingReview = useCallback(() => {
    const accepted = reviewStore.getPendingReview();
    if (!accepted) {
      return;
    }
    acceptReviewNotification(api, accepted.createdAt);
    reviewStore.setState(reviewStore.getState(), null);
    setState(accepted);
    setIsStale(!!accepted.stale);
    setPendingReview(null);
    sessionStore.remove(AUTO_ENTERED_SESSION_KEY);
    enterReview();
    navigate(buildReviewChangesSummaryHref(), { plain: true });
  }, [api, enterReview, navigate]);

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
  const newlyAddedStoryIds = useMemo(
    () => (state ? buildNewlyAddedStoryIds(state, allStatuses) : new Set<string>()),
    [allStatuses, state]
  );

  const storyInfo = useMemo(
    () => (state ? buildStoryInfo(state, index, api, allStatuses, newlyAddedStoryIds) : {}),
    [allStatuses, api, index, newlyAddedStoryIds, state]
  );

  const collectionIndex = parseCollectionIndex(collectionParam);
  const storyIdFromPath = parseStoryIdFromPath(path);
  const activeEntry =
    state && storyIdFromPath
      ? resolveActiveNavEntry(flattenedEntries, storyIdFromPath, collectionIndex)
      : null;
  const activeIndex = activeEntry ? resolveNavIndex(flattenedEntries, activeEntry) : -1;

  const isSummaryVisible = isReviewSummaryPath(path);

  // Report a "pageview" whenever the active review surface changes: the summary
  // overlay, or a specific reviewed story's detail view. Keyed so re-renders that
  // don't change the surface (or story) don't re-fire.
  useEffect(() => {
    if (!state) {
      lastPageviewKeyRef.current = null;
      return;
    }
    let page: 'summary' | 'detail' | null = null;
    let key: string | null = null;
    if (isSummaryVisible) {
      page = 'summary';
      key = 'summary';
    } else if (isInReviewMode && activeEntry) {
      page = 'detail';
      key = `detail:${activeEntry.storyId}`;
    }
    if (!page || key === lastPageviewKeyRef.current) {
      return;
    }
    lastPageviewKeyRef.current = key;
    emit(EVENTS.PAGEVIEW, { page, reviewCreatedAt: state.createdAt });
  }, [state, isSummaryVisible, isInReviewMode, activeEntry, emit]);

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
    if (sessionStore.read(REVIEW_EXITING_SESSION_KEY) === '1') {
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
      notificationKey: reviewNotificationKey(state, pendingReview),
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
      pendingReview,
      isStale,
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
    reviewStore.setState(value, pendingReview);
  }, [value, pendingReview]);

  useLayoutEffect(() => {
    if (isSummaryVisible) {
      reviewStore.releaseSummaryOverlaySuppression();
    }
  }, [isSummaryVisible]);

  return children;
};
