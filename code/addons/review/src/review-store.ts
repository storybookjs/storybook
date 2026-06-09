import { useSyncExternalStore } from 'react';

import type { StoryInfo } from './components/CollectionGrid.tsx';
import type { CompareMode } from './constants.ts';
import type { ReviewNavEntry } from './review-navigation.ts';
import type { ReviewState } from './review-state.ts';

export interface ReviewStoreState {
  state: ReviewState | null;
  isStale: boolean;
  storyInfo: Record<string, StoryInfo>;
  flattenedEntries: ReviewNavEntry[];
  newlyAddedStoryIds: Set<string>;
  activeEntry: ReviewNavEntry | null;
  activeIndex: number;
  isInReviewSession: boolean;
  isSummaryVisible: boolean;
  compareMode: CompareMode;
  showCompare: boolean;
  getStoryPreviewHref: (storyId: string) => string;
  setCompareMode: (mode: CompareMode) => void;
}

const emptyStore: ReviewStoreState = {
  state: null,
  isStale: false,
  storyInfo: {},
  flattenedEntries: [],
  newlyAddedStoryIds: new Set(),
  activeEntry: null,
  activeIndex: -1,
  isInReviewSession: false,
  isSummaryVisible: false,
  compareMode: 'latest',
  showCompare: false,
  getStoryPreviewHref: () => '',
  setCompareMode: () => {},
};

let currentStore: ReviewStoreState = emptyStore;
const listeners = new Set<() => void>();

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
};

export const useReview = (): ReviewStoreState =>
  useSyncExternalStore(reviewStore.subscribe, reviewStore.getState, reviewStore.getState);
