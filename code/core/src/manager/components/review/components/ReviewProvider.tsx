import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
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
  useChannel,
  useServiceQuery,
  useStorybookApi,
  useStorybookState,
} from 'storybook/manager-api';

import { AUTO_ENTERED_SESSION_KEY, EVENTS, PRE_REVIEW_RETURN_KEY } from '../constants.ts';
import { acceptPendingReview, navigateOutOfReview } from '../review-actions.ts';
import { enterReviewMode, isReviewModeActive } from '../review-mode.ts';
import {
  REVIEW_COLLECTION_QUERY_PARAM,
  buildFlattenedNavEntries,
  isReviewReturnSearch,
  isReviewSummaryPath,
  parseCollectionIndex,
  parseStoryIdFromPath,
  resolveActiveNavEntry,
  resolveNavIndex,
} from '../review-navigation.ts';
import { clearReviewNotificationsOnDismiss } from '../review-notification.ts';
import type { ReviewState } from '../review-state.ts';
import {
  applyReviewStatuses,
  clearReviewStatuses,
  collectReviewStoryIds,
} from '../review-status.ts';
import {
  reviewStore,
  useReview,
  type ReviewBanner,
  type ReviewDerivedState,
} from '../review-store.ts';
import { buildNewlyAddedStoryIds, buildStoryInfo } from '../review-story-info.ts';
import { sessionStore } from '../session-store.ts';
import { useReviewFiltersRef } from '../useReviewFiltersRef.ts';

const reviewStatusStore = experimental_getStatusStore(REVIEW_STATUS_TYPE_ID);

/**
 * Projects the review service's live `current` and `pending` queries into
 * reviewStore and keeps its index-, status-, and route-dependent UI values up
 * to date.
 */
export const ReviewProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const api = useStorybookApi();
  const navigate = useNavigate();
  const { index, internal_index, path, viewMode, customQueryParams, location } =
    useStorybookState();
  const { isInReviewMode } = useReview();
  const reviewService = getService('core/review', { internal: true });
  const { data: currentData } = useServiceQuery(reviewService.queries.current);
  const { data: pendingData } = useServiceQuery(reviewService.queries.pending);
  // `undefined` means the query has not loaded yet; render as "no review" but
  // skip dismissal side effects until the authoritative value arrives.
  const review = currentData ?? null;
  const pendingReview = pendingData ?? null;
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
      // Dismissed (possibly from another tab): leave review mode and drop
      // statuses, notifications, and the one-time auto-enter.
      clearReviewStatuses(reviewStatusStore);
      sessionStore.remove(AUTO_ENTERED_SESSION_KEY);
      clearReviewNotificationsOnDismiss(api, previous.current, previous.pending);
      reviewStore.setReviewMode(false);
      return;
    }

    if (currentData.createdAt !== previous.current?.createdAt) {
      // A new review became current (first display or an accepted update):
      // re-arm the one-time summary auto-enter.
      sessionStore.remove(AUTO_ENTERED_SESSION_KEY);
    }
  }, [api, currentData, pendingData]);

  const emit = useChannel({
    [EVENTS.REVIEW_DISMISSED]: (returnSearch?: string | null) => {
      void navigateOutOfReview(api, navigate, returnSearch, { recordVisit: false });
    },
  });

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

  const flattenedEntries = useMemo(
    () => (review ? buildFlattenedNavEntries(review) : []),
    [review]
  );

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

  const isSummaryVisible = isReviewSummaryPath(path);

  const onAcceptPendingUpdate = useCallback(() => {
    void acceptPendingReview(api, navigate, filtersRef.current);
  }, [api, navigate, filtersRef]);

  // Pending-update outranks stale: accepting the update supersedes the warning.
  const banner = useMemo<ReviewBanner>(
    () =>
      pendingReview !== null
        ? { kind: 'pending-update', onAccept: onAcceptPendingUpdate }
        : review?.stale
          ? { kind: 'stale' }
          : null,
    [pendingReview, review?.stale, onAcceptPendingUpdate]
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
    emit(EVENTS.PAGEVIEW, { page, reviewCreatedAt: review.createdAt });
  }, [review, isSummaryVisible, isInReviewMode, activeEntry, emit]);

  // First landing on the summary with a clean, newly available review enters
  // review mode once. Deduplicated so reloads and post-exit returns don't re-enter.
  useEffect(() => {
    if (!review || !isSummaryVisible || isReviewModeActive()) {
      return;
    }
    if (reviewStore.getState().isExiting) {
      return;
    }
    if (sessionStore.read(AUTO_ENTERED_SESSION_KEY) === '1') {
      return;
    }
    sessionStore.write(AUTO_ENTERED_SESSION_KEY, '1');
    void enterReviewMode(api, filtersRef.current);
  }, [review, isSummaryVisible, api, filtersRef]);

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

  const derived = useMemo<ReviewDerivedState>(
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
    ]
  );

  // Sync before paint so toolbar surfaces read current route on first frame.
  useLayoutEffect(() => {
    reviewStore.setDerived(derived);
  }, [derived]);

  return children;
};
