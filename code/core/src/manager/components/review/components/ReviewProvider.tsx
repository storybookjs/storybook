import React, {
  useCallback,
  useEffect,
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
  getService,
  useServiceQuery,
  useStorybookApi,
  useStorybookState,
} from 'storybook/manager-api';

import {
  AUTO_ENTERED_SESSION_KEY,
  EVENTS,
  PRE_REVIEW_RETURN_KEY,
  REVIEW_MODE_SESSION_KEY,
  autoEnteredLatchValue,
} from '../constants.ts';
import {
  acceptPendingReview,
  dismissReview,
  navigateOutOfReview,
  navigateToReviewEntry,
  navigateToReviewSummary,
} from '../review-actions.ts';
import { ReviewContext, type ReviewBanner, type ReviewContextValue } from '../review-context.ts';
import { enterReviewMode, type ReviewModeHandle } from '../review-mode.ts';
import {
  REVIEW_COLLECTION_QUERY_PARAM,
  isReviewReturnSearch,
  isReviewSummaryPath,
  parseCollectionIndex,
  parseStoryIdFromPath,
  resolveActiveNavEntry,
  resolveNavIndex,
  type ReviewNavEntry,
} from '../review-navigation.ts';
import { clearReviewNotificationsOnDismiss } from '../review-notification.ts';
import type { ReviewState } from '../review-state.ts';
import {
  applyReviewStatuses,
  clearReviewStatuses,
  collectReviewStoryIds,
} from '../review-status.ts';
import { buildNewlyAddedStoryIds, buildStoryInfo } from '../review-story-info.ts';
import { sessionStore } from '../session-store.ts';
import { useReviewFiltersRef } from '../useReviewFiltersRef.ts';

const reviewStatusStore = experimental_getStatusStore(REVIEW_STATUS_TYPE_ID);

const EMPTY_ENTRIES: ReviewNavEntry[] = [];

/**
 * Provides {@link ReviewContext}: projects the review service's live queries,
 * owns the per-tab review-mode flag, derives the index-, status-, and
 * route-dependent UI values, and binds the review actions.
 */
export const ReviewProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const api = useStorybookApi();
  const navigate = useNavigate();
  const { index, internal_index, path, viewMode, customQueryParams, location } =
    useStorybookState();
  const reviewService = getService('core/review', { internal: true });
  const { data: currentData } = useServiceQuery(reviewService.queries.current);
  const { data: pendingData } = useServiceQuery(reviewService.queries.pending);
  const { data: entriesData } = useServiceQuery(reviewService.queries.flattenedEntries);
  const { data: bannerKind } = useServiceQuery(reviewService.queries.bannerKind);
  // `undefined` means the query has not loaded yet; render as "no review" but
  // skip dismissal side effects until the authoritative value arrives.
  const review = currentData ?? null;
  const pendingReview = pendingData ?? null;
  const flattenedEntries = entriesData ?? EMPTY_ENTRIES;

  // Per-tab review mode, persisted so it survives reloads. The only sessionStorage
  // key that drives render, so it is wrapped in React state initialized from it.
  const [isInReviewMode, setIsInReviewMode] = useState(
    () => sessionStore.read(REVIEW_MODE_SESSION_KEY) === '1'
  );
  // Mirror for fresh reads: actions check the flag mid-flight (idempotent entry),
  // where a render-time snapshot could be stale.
  const isInReviewModeRef = useRef(isInReviewMode);
  const mode = useMemo<ReviewModeHandle>(
    () => ({
      isActive: () => isInReviewModeRef.current,
      setActive: (active: boolean) => {
        isInReviewModeRef.current = active;
        if (active) {
          sessionStore.write(REVIEW_MODE_SESSION_KEY, '1');
        } else {
          sessionStore.remove(REVIEW_MODE_SESSION_KEY);
        }
        setIsInReviewMode(active);
      },
    }),
    []
  );

  // True while navigateOutOfReview is in flight; blocks the summary auto-enter.
  // Nothing renders from it, so it stays a ref rather than state.
  const isExitingRef = useRef(false);
  const setExiting = useCallback((exiting: boolean) => {
    isExitingRef.current = exiting;
  }, []);

  // Last review page reported to telemetry; dedupes pageviews across re-renders.
  const lastPageviewKeyRef = useRef<string | null>(null);
  // Last projected payloads, so dismissal cleanup can clear their notifications.
  const lastProjectedRef = useRef<{
    current: ReviewState | null;
    pending: ReviewState | null;
  }>({ current: null, pending: null });

  const collectionParam = customQueryParams?.[REVIEW_COLLECTION_QUERY_PARAM] as string | undefined;

  // Current sidebar filters, snapshotted by enterReviewMode and restored on exit.
  const filtersRef = useReviewFiltersRef();

  const isSummaryVisible = isReviewSummaryPath(path);
  // Fresh read for the dismissal reaction, which must not re-run on route changes.
  const isSummaryVisibleRef = useRef(isSummaryVisible);
  isSummaryVisibleRef.current = isSummaryVisible;

  useEffect(() => {
    if (currentData === undefined) {
      return;
    }
    const previous = lastProjectedRef.current;
    lastProjectedRef.current = { current: currentData, pending: pendingData ?? null };

    if (currentData === null) {
      if (previous.current === null && previous.pending === null) {
        return;
      }
      // Dismissed (possibly from another tab): drop statuses, notifications,
      // and the one-time auto-enter.
      clearReviewStatuses(reviewStatusStore);
      sessionStore.remove(AUTO_ENTERED_SESSION_KEY);
      clearReviewNotificationsOnDismiss(api, previous.current, previous.pending);
      if (isInReviewModeRef.current || isSummaryVisibleRef.current) {
        // This tab was on a review surface: return it to its own pre-review
        // canvas. Tabs that never entered the review stay where they are.
        void navigateOutOfReview(api, navigate, sessionStore.read(PRE_REVIEW_RETURN_KEY), mode, {
          onExitingChange: setExiting,
        });
      }
      return;
    }
  }, [api, navigate, mode, setExiting, currentData, pendingData]);

  // Tag every story in the active review so the sidebar shows reviewing status
  // and the filter menu can count them. Filtering is owned by review mode. The
  // service query re-emits on every state change (including stale flips), so
  // statuses stay in sync with the authoritative payload.
  useEffect(() => {
    if (!review) {
      return;
    }
    applyReviewStatuses(reviewStatusStore, collectReviewStoryIds(review));
  }, [review]);

  const allStatuses = experimental_useStatusStore() as StatusesByStoryIdAndTypeId;
  const newlyAddedStoryIds = useMemo(
    () => (review ? buildNewlyAddedStoryIds(review, allStatuses) : new Set<string>()),
    [allStatuses, review]
  );

  const storyInfo = useMemo(
    () =>
      review
        ? buildStoryInfo(review, index, internal_index, api, allStatuses, newlyAddedStoryIds)
        : {},
    [allStatuses, api, index, internal_index, newlyAddedStoryIds, review]
  );

  const collectionIndex = parseCollectionIndex(collectionParam);
  const storyIdFromPath = parseStoryIdFromPath(path);
  const activeEntry =
    review && storyIdFromPath
      ? resolveActiveNavEntry(flattenedEntries, storyIdFromPath, collectionIndex)
      : null;
  const activeIndex = activeEntry ? resolveNavIndex(flattenedEntries, activeEntry) : -1;

  const openSummary = useCallback(() => {
    navigateToReviewSummary(api, navigate, filtersRef.current, mode);
  }, [api, navigate, filtersRef, mode]);

  const openEntry = useCallback(
    (entry: ReviewNavEntry) => {
      navigateToReviewEntry(api, navigate, entry, filtersRef.current, mode);
    },
    [api, navigate, filtersRef, mode]
  );

  const reviewCreatedAt = review?.createdAt;
  const leaveReview = useCallback(() => {
    void navigateOutOfReview(api, navigate, sessionStore.read(PRE_REVIEW_RETURN_KEY), mode, {
      visitCreatedAt: reviewCreatedAt,
      onExitingChange: setExiting,
    });
  }, [api, navigate, mode, reviewCreatedAt, setExiting]);

  const hasReview = review !== null;
  const dismiss = useCallback(() => {
    if (!hasReview) {
      // Nothing to dismiss service-side: just close the empty review surface locally.
      void navigateOutOfReview(api, navigate, sessionStore.read(PRE_REVIEW_RETURN_KEY), mode, {
        onExitingChange: setExiting,
      });
      return;
    }
    // Navigation happens per tab in the `current → null` reaction above.
    void dismissReview();
  }, [api, navigate, mode, hasReview, setExiting]);

  const onAcceptPendingUpdate = useCallback(() => {
    void acceptPendingReview(api, navigate, filtersRef.current, mode, pendingReview);
  }, [api, navigate, filtersRef, mode, pendingReview]);

  // The banner kind is service-derived; only the accept callback is React-side.
  const banner = useMemo<ReviewBanner>(
    () =>
      bannerKind === 'pending-update'
        ? { kind: 'pending-update', onAccept: onAcceptPendingUpdate }
        : bannerKind === 'stale'
          ? { kind: 'stale' }
          : null,
    [bannerKind, onAcceptPendingUpdate]
  );

  // Report a "pageview" whenever the active review surface changes: the summary
  // overlay, or a specific reviewed story's detail view. Keyed so re-renders that
  // don't change the surface (or story) don't re-fire.
  useEffect(() => {
    if (!review) {
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
    api.emit(EVENTS.PAGEVIEW, { page, reviewCreatedAt: review.createdAt });
  }, [review, isSummaryVisible, isInReviewMode, activeEntry, api]);

  // First landing on the summary with a clean, newly available review enters
  // review mode once. The latch stores the review it was armed for, so reloads and
  // post-exit returns don't re-enter while a later review still auto-enters once.
  useEffect(() => {
    if (!review || !isSummaryVisible || mode.isActive()) {
      return;
    }
    if (isExitingRef.current) {
      return;
    }
    const latch = autoEnteredLatchValue(review.createdAt);
    if (sessionStore.read(AUTO_ENTERED_SESSION_KEY) === latch) {
      return;
    }
    sessionStore.write(AUTO_ENTERED_SESSION_KEY, latch);
    void enterReviewMode(api, filtersRef.current, mode);
  }, [review, isSummaryVisible, api, filtersRef, mode]);

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

  const value = useMemo<ReviewContextValue>(
    () => ({
      review,
      pendingReview,
      storyInfo,
      flattenedEntries,
      newlyAddedStoryIds,
      activeEntry,
      activeIndex,
      isSummaryVisible,
      banner,
      isInReviewMode,
      openSummary,
      openEntry,
      leaveReview,
      dismiss,
    }),
    [
      review,
      pendingReview,
      storyInfo,
      flattenedEntries,
      newlyAddedStoryIds,
      activeEntry,
      activeIndex,
      isSummaryVisible,
      banner,
      isInReviewMode,
      openSummary,
      openEntry,
      leaveReview,
      dismiss,
    ]
  );

  return <ReviewContext.Provider value={value}>{children}</ReviewContext.Provider>;
};
