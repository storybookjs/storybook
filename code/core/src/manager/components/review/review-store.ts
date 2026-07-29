import { useSyncExternalStore } from 'react';

import { REVIEW_NAMESPACE } from '../../../shared/review/index.ts';

import type { AttentionBannerProps } from './components/AttentionBanner.tsx';
import type { ReviewNavEntry } from './review-navigation.ts';
import type { ReviewState } from './review-state.ts';
import type { StoryInfo } from './review-types.ts';
import { sessionStore } from './session-store.ts';

// Persisted flag marking the manager as being in review mode. Review mode is
// interaction-driven (never inferred from the URL) and survives reloads via
// this key. Owned by the store so `isInReviewMode` has a single write path.
const REVIEW_MODE_SESSION_KEY = `${REVIEW_NAMESPACE}/review-mode`;

/**
 * The attention banner to render at the top of review surfaces, if any.
 * Pending-update outranks stale: accepting the update supersedes the warning.
 */
export type ReviewBanner = AttentionBannerProps | null;

/**
 * Values the store cannot compute itself because they depend on React-land
 * inputs (the review service's live queries, the Storybook index, statuses, and
 * the current route). ReviewProvider recomputes them whenever their inputs
 * change and pushes them via {@link reviewStore.setDerived}. The review
 * payloads are pure projections of the `core/review` service queries — the
 * store has no write path that could disagree with the service.
 */
export interface ReviewDerivedState {
  /** The current review projected from the service's `current` query. */
  review: ReviewState | null;
  /** The deferred review update projected from the service's `pending` query. */
  pendingReview: ReviewState | null;
  storyInfo: Record<string, StoryInfo>;
  flattenedEntries: ReviewNavEntry[];
  newlyAddedStoryIds: Set<string>;
  activeEntry: ReviewNavEntry | null;
  activeIndex: number;
  isSummaryVisible: boolean;
  banner: ReviewBanner;
}

export interface ReviewStoreState extends ReviewDerivedState {
  isInReviewMode: boolean;
  /** True while navigateOutOfReview is in flight; blocks the summary auto-enter. */
  isExiting: boolean;
}

interface ReviewCoreState {
  isInReviewMode: boolean;
  isExiting: boolean;
}

const emptyCore: ReviewCoreState = {
  isInReviewMode: false,
  isExiting: false,
};

const emptyDerived: ReviewDerivedState = {
  review: null,
  pendingReview: null,
  storyInfo: {},
  flattenedEntries: [],
  newlyAddedStoryIds: new Set(),
  activeEntry: null,
  activeIndex: -1,
  isSummaryVisible: false,
  banner: null,
};

let core: ReviewCoreState = {
  ...emptyCore,
  isInReviewMode: sessionStore.read(REVIEW_MODE_SESSION_KEY) === '1',
};
let derived: ReviewDerivedState = emptyDerived;

const buildSnapshot = (): ReviewStoreState => ({
  ...derived,
  isInReviewMode: core.isInReviewMode,
  isExiting: core.isExiting,
});

let snapshot: ReviewStoreState = buildSnapshot();

const listeners = new Set<() => void>();

const notify = () => {
  snapshot = buildSnapshot();
  listeners.forEach((listener) => listener());
};

const commit = (patch: Partial<ReviewCoreState>) => {
  core = { ...core, ...patch };
  notify();
};

/**
 * Manager-local review-mode, transition, and route-derived UI state. Review
 * payloads live in the `core/review` service; this store only mirrors them via
 * the derived projection ReviewProvider pushes.
 */
export const reviewStore = {
  getState: (): ReviewStoreState => snapshot,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Toggle review mode, persisted so it survives reloads. */
  setReviewMode: (active: boolean) => {
    if (active) {
      sessionStore.write(REVIEW_MODE_SESSION_KEY, '1');
    } else {
      sessionStore.remove(REVIEW_MODE_SESSION_KEY);
    }
    commit({ isInReviewMode: active });
  },
  setExiting: (isExiting: boolean) => {
    commit({ isExiting });
  },
  /** Push values derived by ReviewProvider from service/index/status/route inputs. */
  setDerived: (next: ReviewDerivedState) => {
    derived = next;
    notify();
  },
  reset: () => {
    core = { ...emptyCore };
    derived = emptyDerived;
    notify();
  },
};

export const useReview = (): ReviewStoreState =>
  useSyncExternalStore(reviewStore.subscribe, reviewStore.getState, reviewStore.getState);
