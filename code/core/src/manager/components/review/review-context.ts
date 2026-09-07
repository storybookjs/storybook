import { createContext, useContext } from 'react';

import type { AttentionBannerProps } from './components/AttentionBanner.tsx';
import type { ReviewNavEntry } from './review-navigation.ts';
import type { ReviewState } from './review-state.ts';
import type { StoryInfo } from './review-types.ts';

/**
 * The attention banner to render at the top of review surfaces, if any.
 * Pending-update outranks stale: accepting the update supersedes the warning.
 */
export type ReviewBanner = AttentionBannerProps | null;

/**
 * Review state and bound actions for the manager's review surfaces. Provided by
 * ReviewProvider; components read this instead of importing stores or learning
 * where persistence lives.
 */
export interface ReviewContextValue {
  /** The current review projected from the service's `current` query. */
  review: ReviewState | null;
  /** The deferred review update projected from the service's `pending` query. */
  pendingReview: ReviewState | null;
  storyInfo: Record<string, StoryInfo>;
  /** Navigable story slots projected from the service's `flattenedEntries` query. */
  flattenedEntries: ReviewNavEntry[];
  newlyAddedStoryIds: Set<string>;
  activeEntry: ReviewNavEntry | null;
  activeIndex: number;
  isSummaryVisible: boolean;
  banner: ReviewBanner;
  /** Per-tab review mode; interaction-driven and persisted so it survives reloads. */
  isInReviewMode: boolean;
  /** Enter review mode (if needed) and navigate to the review summary. */
  openSummary: () => void;
  /** Enter review mode (if needed) and navigate to a curated story slot. */
  openEntry: (entry: ReviewNavEntry) => void;
  /** Leave review mode and return this tab to its pre-review canvas. */
  leaveReview: () => void;
  /** Dismiss the active review for every tab (or close an empty summary locally). */
  dismiss: () => void;
}

const noop = () => {};

/**
 * The default value doubles as the feature-off state: with no provider mounted,
 * consumers see no review and inert callbacks, so surfaces like the sidebar
 * widget render nothing without touching the (unregistered) review service.
 */
const emptyReviewContextValue: ReviewContextValue = {
  review: null,
  pendingReview: null,
  storyInfo: {},
  flattenedEntries: [],
  newlyAddedStoryIds: new Set(),
  activeEntry: null,
  activeIndex: -1,
  isSummaryVisible: false,
  banner: null,
  isInReviewMode: false,
  openSummary: noop,
  openEntry: noop,
  leaveReview: noop,
  dismiss: noop,
};

export const ReviewContext = createContext<ReviewContextValue>(emptyReviewContextValue);

export const useReviewContext = (): ReviewContextValue => useContext(ReviewContext);
