import type { NavigateFunction } from 'storybook/internal/router';
import { logger } from 'storybook/internal/client-logger';
import { getService, type API } from 'storybook/manager-api';

import {
  AUTO_ENTERED_SESSION_KEY,
  REVIEW_CHANGES_URL,
  autoEnteredLatchValue,
} from './constants.ts';
import {
  enterReviewMode,
  exitReviewMode,
  type ReviewModeFilters,
  type ReviewModeHandle,
} from './review-mode.ts';
import {
  REVIEW_COLLECTION_QUERY_PARAM,
  buildReviewChangesSummaryHref,
  buildReviewStoryTarget,
  isReviewReturnSearch,
  type ReviewNavEntry,
} from './review-navigation.ts';
import { acceptReviewNotification } from './review-notification.ts';
import { sessionStore } from './session-store.ts';
import type { ReviewState } from './review-state.ts';

export interface NavigateOutOfReviewOptions {
  /** Server `createdAt` of the displayed review; marks it visited so the arrival toast does not re-fire. */
  visitCreatedAt?: number;
  /** Signals while the exit is in flight; ReviewProvider uses it to block the summary auto-enter. */
  onExitingChange?: (exiting: boolean) => void;
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
  filters: ReviewModeFilters,
  mode: ReviewModeHandle
): void => {
  void enterReviewMode(api, filters, mode);
  api.setQueryParams({ [REVIEW_COLLECTION_QUERY_PARAM]: String(entry.collectionIndex) });
  navigate(buildReviewStoryTarget(entry));
};

/** Navigate back to the review summary, entering (or staying in) review mode. */
export const navigateToReviewSummary = (
  api: API,
  navigate: NavigateFunction,
  filters: ReviewModeFilters,
  mode: ReviewModeHandle
): void => {
  void enterReviewMode(api, filters, mode);
  api.setQueryParams({ [REVIEW_COLLECTION_QUERY_PARAM]: null });
  navigate(REVIEW_CHANGES_URL);
};

/**
 * Leave review mode and return to the pre-review canvas. Shared by the summary
 * back-to-Storybook link and the per-tab dismissal reaction; restores filters via
 * {@link exitReviewMode} and navigates to the captured return search.
 */
export const navigateOutOfReview = async (
  api: API,
  navigate: NavigateFunction,
  returnSearch: string | null | undefined,
  mode: ReviewModeHandle,
  { visitCreatedAt, onExitingChange }: NavigateOutOfReviewOptions = {}
): Promise<void> => {
  api.setQueryParams({ [REVIEW_COLLECTION_QUERY_PARAM]: null });

  onExitingChange?.(true);
  try {
    await exitReviewMode(api, mode);

    if (visitCreatedAt !== undefined) {
      acceptReviewNotification(api, visitCreatedAt);
    }

    if (returnSearch && !isReviewReturnSearch(returnSearch)) {
      navigate(returnSearch.startsWith('?') ? returnSearch : `?${returnSearch}`, { plain: true });
      return;
    }

    api.selectFirstStory();
  } finally {
    onExitingChange?.(false);
  }
};

/**
 * Clear the active review for every tab through the review service. Navigation
 * is not performed here: each tab reacts to the service's `current → null`
 * transition locally, returning to its own pre-review canvas.
 */
export const dismissReview = async (): Promise<void> => {
  try {
    await getService('core/review', { internal: true }).commands.dismissReview(undefined);
  } catch (error) {
    logger.error('Failed to dismiss review', error);
  }
};

/**
 * Promote the deferred review through the review service, enter review mode
 * and navigate to the summary screen. No-op when there is nothing pending.
 */
export const acceptPendingReview = async (
  api: API,
  navigate: NavigateFunction,
  filters: ReviewModeFilters,
  mode: ReviewModeHandle,
  pending: ReviewState | null
): Promise<void> => {
  if (!pending) {
    return;
  }
  try {
    await getService('core/review', { internal: true }).commands.acceptPending(undefined);
  } catch (error) {
    logger.error('Failed to accept pending review', error);
    return;
  }
  acceptReviewNotification(api, pending.createdAt);
  // Accepting enters the promoted review here, so arm its latch: landing on the
  // summary later must not auto-enter a review the reviewer already left.
  sessionStore.write(AUTO_ENTERED_SESSION_KEY, autoEnteredLatchValue(pending.createdAt));
  void enterReviewMode(api, filters, mode);
  navigate(buildReviewChangesSummaryHref(), { plain: true });
};
