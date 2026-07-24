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
 * inputs (the Storybook index, statuses, and the current route). ReviewProvider
 * recomputes them whenever their inputs change and pushes them via
 * {@link reviewStore.setDerived}.
 */
export interface ReviewDerivedState {
  storyInfo: Record<string, StoryInfo>;
  flattenedEntries: ReviewNavEntry[];
  newlyAddedStoryIds: Set<string>;
  activeEntry: ReviewNavEntry | null;
  activeIndex: number;
  isSummaryVisible: boolean;
  banner: ReviewBanner;
}

export interface ReviewStoreState extends ReviewDerivedState {
  /** The displayed review. */
  state: ReviewState | null;
  /** An updated payload held back until the user accepts it. */
  pendingReview: ReviewState | null;
  isStale: boolean;
  isInReviewMode: boolean;
  /** True while navigateOutOfReview is in flight; blocks the summary auto-enter. */
  isExiting: boolean;
}

interface ReviewCoreState {
  state: ReviewState | null;
  pendingReview: ReviewState | null;
  isStale: boolean;
  isInReviewMode: boolean;
  isExiting: boolean;
}

const emptyCore: ReviewCoreState = {
  state: null,
  pendingReview: null,
  isStale: false,
  isInReviewMode: false,
  isExiting: false,
};

const emptyDerived: ReviewDerivedState = {
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
  state: core.state,
  pendingReview: core.pendingReview,
  isStale: core.isStale,
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
 * Manager-local projection of the authoritative OSA review state plus deferred,
 * transition, review-mode, and route-derived UI state.
 */
export const reviewStore = {
  getState: (): ReviewStoreState => snapshot,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Show a review, replacing any displayed or deferred one. */
  displayReview: (next: ReviewState) => {
    commit({ state: next, pendingReview: null, isStale: !!next.stale });
  },
  /** Hold an updated payload until the user accepts it. */
  deferReview: (next: ReviewState) => {
    commit({ pendingReview: next });
  },
  setStale: (isStale: boolean) => {
    commit({ isStale });
  },
  /** Drop all review state (dismissal), including the persisted review-mode flag. */
  clearReview: () => {
    sessionStore.remove(REVIEW_MODE_SESSION_KEY);
    commit({ state: null, pendingReview: null, isStale: false, isInReviewMode: false });
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
  /** Push values derived by ReviewProvider from index/status/route inputs. */
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
