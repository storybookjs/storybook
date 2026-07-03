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
  useChannel,
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
  clearReviewStatuses,
  collectReviewStoryIds,
  syncReviewStatuses,
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

const isDeferredReviewUpdate = (current: ReviewState | null, next: ReviewState): boolean =>
  current !== null &&
  current.createdAt !== undefined &&
  next.createdAt !== undefined &&
  current.createdAt !== next.createdAt;

const isSameReviewPayload = (current: ReviewState | null, next: ReviewState): boolean =>
  current?.createdAt !== undefined && current.createdAt === next.createdAt;

/**
 * Wires channel events to reviewStore actions and keeps the store's derived
 * values (index-, status- and route-dependent) up to date. The store owns the
 * state; this component is its only React-side writer.
 */
export const ReviewProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const previousReviewStoryIdsRef = useRef<Set<string>>(new Set());

  const api = useStorybookApi();
  const navigate = useNavigate();
  const { index, path, viewMode, customQueryParams, location } = useStorybookState();
  const { state, pendingReview, isStale, isInReviewMode } = useReview();
  // Last review page reported to telemetry; dedupes pageviews across re-renders.
  const lastPageviewKeyRef = useRef<string | null>(null);

  const collectionParam = customQueryParams?.[REVIEW_COLLECTION_QUERY_PARAM] as string | undefined;

  // Current sidebar filters, snapshotted by enterReviewMode and restored on exit.
  const filtersRef = useReviewFiltersRef();

  const emit = useChannel({
    [EVENTS.DISPLAY_REVIEW]: (next: ReviewState) => {
      const current = reviewStore.getState().state;
      if (isDeferredReviewUpdate(current, next)) {
        reviewStore.deferReview(next);
        return;
      }
      // REQUEST_REVIEW replays the cached payload to every tab when another tab
      // mounts; ignore identical reviews so summary UI state is not reset.
      if (isSameReviewPayload(current, next)) {
        reviewStore.setStale(!!next.stale);
        return;
      }
      // A fresh payload re-arms the one-time auto-enter.
      sessionStore.remove(AUTO_ENTERED_SESSION_KEY);
      reviewStore.displayReview(next);
    },
    [EVENTS.REVIEW_STALE]: () => {
      reviewStore.setStale(true);
    },
    [EVENTS.REVIEW_DISMISSED]: (returnSearch?: string | null) => {
      clearReviewStatuses(reviewStatusStore);
      previousReviewStoryIdsRef.current = new Set();
      sessionStore.remove(AUTO_ENTERED_SESSION_KEY);
      const { state: displayed, pendingReview: deferred } = reviewStore.getState();
      clearReviewNotificationsOnDismiss(api, displayed, deferred);
      reviewStore.clearReview();
      void navigateOutOfReview(api, navigate, returnSearch, { recordVisit: false });
    },
  });

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

  const onAcceptPendingUpdate = useCallback(() => {
    acceptPendingReview(api, navigate, filtersRef.current);
  }, [api, navigate, filtersRef]);

  // Pending-update outranks stale: accepting the update supersedes the warning.
  const banner = useMemo<ReviewBanner>(
    () =>
      pendingReview !== null
        ? { kind: 'pending-update', onAccept: onAcceptPendingUpdate }
        : isStale
          ? { kind: 'stale' }
          : null,
    [pendingReview, isStale, onAcceptPendingUpdate]
  );

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

  // First landing on the summary with a clean, newly available review enters
  // review mode once. Deduplicated so reloads and post-exit returns don't re-enter.
  useEffect(() => {
    if (!state || !isSummaryVisible || isReviewModeActive()) {
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
  }, [state, isSummaryVisible, api, filtersRef]);

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
      storyInfo,
      flattenedEntries,
      newlyAddedStoryIds,
      activeEntry,
      activeIndex,
      isSummaryVisible,
      banner,
    }),
    [
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
