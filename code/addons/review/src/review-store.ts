import { useSyncExternalStore } from 'react';

import type { StoryInfo } from './components/CollectionGrid.tsx';
import type { ReviewNavEntry } from './review-navigation.ts';
import type { ReviewState } from './review-state.ts';

export interface ReviewStoreState {
  state: ReviewState | null;
  isStale: boolean;
  hasPendingUpdate: boolean;
  onAcceptPendingUpdate: () => void;
  storyInfo: Record<string, StoryInfo>;
  flattenedEntries: ReviewNavEntry[];
  newlyAddedStoryIds: Set<string>;
  activeEntry: ReviewNavEntry | null;
  activeIndex: number;
  isInReviewMode: boolean;
  isSummaryVisible: boolean;
  getStoryPreviewHref: (storyId: string) => string;
  dismissReview: () => void;
}

const emptyStore: ReviewStoreState = {
  state: null,
  isStale: false,
  hasPendingUpdate: false,
  onAcceptPendingUpdate: () => {},
  storyInfo: {},
  flattenedEntries: [],
  newlyAddedStoryIds: new Set(),
  activeEntry: null,
  activeIndex: -1,
  isInReviewMode: false,
  isSummaryVisible: false,
  getStoryPreviewHref: () => '',
  dismissReview: () => {},
};

let currentStore: ReviewStoreState = emptyStore;
const listeners = new Set<() => void>();

/** Synchronously hide the summary overlay before SPA navigation to a story. */
let summaryOverlaySuppressed = false;

const notify = () => {
  listeners.forEach((listener) => listener());
};

export const reviewStore = {
  getState: () => currentStore,
  setState: (next: ReviewStoreState) => {
    currentStore = next;
    notify();
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  suppressSummaryOverlay: () => {
    if (!summaryOverlaySuppressed) {
      summaryOverlaySuppressed = true;
      notify();
    }
  },
  releaseSummaryOverlaySuppression: () => {
    if (summaryOverlaySuppressed) {
      summaryOverlaySuppressed = false;
      notify();
    }
  },
  isSummaryOverlayShown: () => currentStore.isSummaryVisible && !summaryOverlaySuppressed,
};

export const useReview = (): ReviewStoreState =>
  useSyncExternalStore(reviewStore.subscribe, reviewStore.getState, reviewStore.getState);
