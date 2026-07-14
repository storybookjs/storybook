import type { NavigateFunction } from 'storybook/internal/router';
import { type API } from 'storybook/manager-api';

import {
  AUTO_ENTERED_SESSION_KEY,
  EVENTS,
  PRE_REVIEW_RETURN_KEY,
  REVIEW_CHANGES_URL,
} from './constants.ts';
import { enterReviewMode, exitReviewMode, type ReviewModeFilters } from './review-mode.ts';
import {
  REVIEW_COLLECTION_QUERY_PARAM,
  buildReviewChangesSummaryHref,
  buildReviewStoryTarget,
  isReviewReturnSearch,
  type ReviewNavEntry,
} from './review-navigation.ts';
import { acceptReviewNotification } from './review-notification.ts';
import { reviewStore } from './review-store.ts';
import { sessionStore } from './session-store.ts';

export interface NavigateOutOfReviewOptions {
  /** Mark the displayed review as visited so the arrival toast does not re-fire. */
  recordVisit?: boolean;
}

/**
 * Navigate to a curated story, entering review mode. Entering is idempotent, so
 * this is safe whether or not the user is already reviewing. The summary overlay
 * stays visible until the route leaves the summary; the main preview is unmounted
 * while it does, so no stale story shows through.
 */
export const navigateToReviewEntry = (
  api: API,
  navigate: NavigateFunction,
  entry: ReviewNavEntry,
  filters: ReviewModeFilters
): void => {
  void enterReviewMode(api, filters);
  api.setQueryParams({ [REVIEW_COLLECTION_QUERY_PARAM]: String(entry.collectionIndex) });
  navigate(buildReviewStoryTarget(entry));
};

/** Navigate back to the review summary, entering (or staying in) review mode. */
export const navigateToReviewSummary = (
  api: API,
  navigate: NavigateFunction,
  filters: ReviewModeFilters
): void => {
  void enterReviewMode(api, filters);
  api.setQueryParams({ [REVIEW_COLLECTION_QUERY_PARAM]: null });
  navigate(REVIEW_CHANGES_URL);
};

/**
 * Leave review mode and return to the pre-review canvas. Shared by the summary
 * back-to-Storybook link and review dismissal; restores filters via
 * {@link exitReviewMode} and navigates to the captured return search.
 */
export const navigateOutOfReview = async (
  api: API,
  navigate: NavigateFunction,
  returnSearch: string | null | undefined,
  { recordVisit = true }: NavigateOutOfReviewOptions = {}
): Promise<void> => {
  const visitCreatedAt = recordVisit ? reviewStore.getState().state?.createdAt : undefined;

  api.setQueryParams({ [REVIEW_COLLECTION_QUERY_PARAM]: null });

  reviewStore.setExiting(true);
  try {
    await exitReviewMode(api);

    if (visitCreatedAt !== undefined) {
      acceptReviewNotification(api, visitCreatedAt);
    }

    if (returnSearch && !isReviewReturnSearch(returnSearch)) {
      navigate(returnSearch.startsWith('?') ? returnSearch : `?${returnSearch}`, { plain: true });
      return;
    }

    api.selectFirstStory();
  } finally {
    reviewStore.setExiting(false);
  }
};

/** Clear the active review (if any) and return to the pre-review canvas. */
export const dismissReview = (api: Pick<API, 'emit'>): void => {
  api.emit(EVENTS.DISMISS_REVIEW, sessionStore.read(PRE_REVIEW_RETURN_KEY));
};

/**
 * Swap in the deferred review payload, enter review mode and navigate to the
 * summary screen. No-op when there is nothing pending.
 */
export const acceptPendingReview = (
  api: API,
  navigate: NavigateFunction,
  filters: ReviewModeFilters
): void => {
  const accepted = reviewStore.getState().pendingReview;
  if (!accepted) {
    return;
  }
  acceptReviewNotification(api, accepted.createdAt);
  // A fresh payload re-arms the one-time auto-enter.
  sessionStore.remove(AUTO_ENTERED_SESSION_KEY);
  reviewStore.displayReview(accepted);
  void enterReviewMode(api, filters);
  navigate(buildReviewChangesSummaryHref(), { plain: true });
};
