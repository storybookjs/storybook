import type { NavigateFunction } from 'storybook/internal/router';
import { type API } from 'storybook/manager-api';

import { REVIEW_CHANGES_URL } from './constants.ts';
import { type ReviewModeFilters, enterReviewMode, exitReviewMode } from './review-mode.ts';
import {
  REVIEW_COLLECTION_QUERY_PARAM,
  type ReviewNavEntry,
  buildReviewStoryTarget,
  isReviewReturnSearch,
} from './review-navigation.ts';
import { reviewStore } from './review-store.ts';

/**
 * Navigate to a curated story, entering review mode. Entering is idempotent, so
 * this is safe whether or not the user is already reviewing. The summary overlay
 * is suppressed synchronously to avoid a flash before the route changes.
 */
export const navigateToReviewEntry = (
  api: API,
  navigate: NavigateFunction,
  entry: ReviewNavEntry,
  filters: ReviewModeFilters
): void => {
  void enterReviewMode(api, filters);
  reviewStore.suppressSummaryOverlay();
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
export const navigateOutOfReview = (
  api: API,
  navigate: NavigateFunction,
  returnSearch: string | null | undefined
): void => {
  api.setQueryParams({ [REVIEW_COLLECTION_QUERY_PARAM]: null });
  reviewStore.releaseSummaryOverlaySuppression();
  void exitReviewMode(api);

  if (returnSearch && !isReviewReturnSearch(returnSearch)) {
    navigate(returnSearch.startsWith('?') ? returnSearch : `?${returnSearch}`, { plain: true });
    return;
  }

  api.selectFirstStory();
};
