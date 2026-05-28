import React, {
  type FC,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { groupStoriesByComponent } from './review-grouping.ts';
import type { ReviewTab } from './review-navigation.ts';
import type { ReviewCollection, ReviewState } from './review-state.ts';

// The interactive view state that must outlive the SummaryScreen — it unmounts
// whenever the user drills into a detail page, so the source of truth lives in
// a context provider one level up (ReviewPage) and is read back on remount.
export interface ReviewViewState {
  /** Bumped on every new review payload so consumers can re-initialise. */
  reviewVersion: number;
  expandedCollections: ReadonlySet<number>;
  expandedComponents: ReadonlySet<string>;
  showAllCollections: ReadonlySet<number>;
  showAllComponents: ReadonlySet<string>;
  toggleCollection: (index: number) => void;
  toggleComponent: (componentId: string) => void;
  setCollectionsExpanded: (expanded: Iterable<number>) => void;
  setComponentsExpanded: (expanded: Iterable<string>) => void;
  markCollectionShowAll: (index: number) => void;
  markComponentShowAll: (componentId: string) => void;
  getScroll: (tab: ReviewTab) => number;
  setScroll: (tab: ReviewTab, scrollTop: number) => void;
  /** Re-seed every field from a freshly received review payload. */
  reset: (collections: ReviewCollection[]) => void;
}

const defaultExpandedCollections = (collections: ReviewCollection[]) =>
  new Set(collections.map((_, index) => index));

const defaultExpandedComponents = (collections: ReviewCollection[]) =>
  new Set(groupStoriesByComponent(collections).map((group) => group.componentId));

// Owns the live view state. Held by whoever stays mounted across summary <->
// detail navigation (ReviewPage in production, StandaloneReviewView in stories)
// and shared downward through context.
export function useReviewViewStore(initialCollections: ReviewCollection[] = []): ReviewViewState {
  const [reviewVersion, setReviewVersion] = useState(0);
  const [expandedCollections, setExpandedCollections] = useState(() =>
    defaultExpandedCollections(initialCollections)
  );
  const [expandedComponents, setExpandedComponents] = useState(() =>
    defaultExpandedComponents(initialCollections)
  );
  const [showAllCollections, setShowAllCollections] = useState<Set<number>>(() => new Set());
  const [showAllComponents, setShowAllComponents] = useState<Set<string>>(() => new Set());
  // Scroll offsets are a ref, not state: updating them on every scroll frame
  // should never trigger a re-render of the review tree.
  const scrollByTab = useRef<Record<ReviewTab, number>>({ collections: 0, components: 0 });

  const toggleCollection = useCallback((index: number) => {
    setExpandedCollections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const toggleComponent = useCallback((componentId: string) => {
    setExpandedComponents((prev) => {
      const next = new Set(prev);
      if (next.has(componentId)) {
        next.delete(componentId);
      } else {
        next.add(componentId);
      }
      return next;
    });
  }, []);

  const setCollectionsExpanded = useCallback((expanded: Iterable<number>) => {
    setExpandedCollections(new Set(expanded));
  }, []);

  const setComponentsExpanded = useCallback((expanded: Iterable<string>) => {
    setExpandedComponents(new Set(expanded));
  }, []);

  const markCollectionShowAll = useCallback((index: number) => {
    setShowAllCollections((prev) => (prev.has(index) ? prev : new Set(prev).add(index)));
  }, []);

  const markComponentShowAll = useCallback((componentId: string) => {
    setShowAllComponents((prev) => (prev.has(componentId) ? prev : new Set(prev).add(componentId)));
  }, []);

  const getScroll = useCallback((tab: ReviewTab) => scrollByTab.current[tab] ?? 0, []);

  const setScroll = useCallback((tab: ReviewTab, scrollTop: number) => {
    scrollByTab.current[tab] = scrollTop;
  }, []);

  const reset = useCallback((collections: ReviewCollection[]) => {
    setExpandedCollections(defaultExpandedCollections(collections));
    setExpandedComponents(defaultExpandedComponents(collections));
    setShowAllCollections(new Set());
    setShowAllComponents(new Set());
    scrollByTab.current = { collections: 0, components: 0 };
    setReviewVersion((version) => version + 1);
  }, []);

  return useMemo(
    () => ({
      reviewVersion,
      expandedCollections,
      expandedComponents,
      showAllCollections,
      showAllComponents,
      toggleCollection,
      toggleComponent,
      setCollectionsExpanded,
      setComponentsExpanded,
      markCollectionShowAll,
      markComponentShowAll,
      getScroll,
      setScroll,
      reset,
    }),
    [
      reviewVersion,
      expandedCollections,
      expandedComponents,
      showAllCollections,
      showAllComponents,
      toggleCollection,
      toggleComponent,
      setCollectionsExpanded,
      setComponentsExpanded,
      markCollectionShowAll,
      markComponentShowAll,
      getScroll,
      setScroll,
      reset,
    ]
  );
}

const ReviewViewContext = createContext<ReviewViewState | null>(null);

export const ReviewViewProvider = ReviewViewContext.Provider;

export function useReviewView(): ReviewViewState {
  const value = useContext(ReviewViewContext);
  if (!value) {
    throw new Error('useReviewView must be used within a ReviewViewProvider');
  }
  return value;
}

// Self-contained provider for rendering the review screens outside the manager
// (stories, prototypes). Seeds the store from the payload on first render — so
// collections start expanded with no flash — and re-seeds when the payload
// changes between stories.
export const StandaloneReviewView: FC<{ state: ReviewState | null; children: ReactNode }> = ({
  state,
  children,
}) => {
  const store = useReviewViewStore(state?.collections ?? []);
  const { reset } = store;
  const lastStateRef = useRef(state);
  useEffect(() => {
    if (state && state !== lastStateRef.current) {
      lastStateRef.current = state;
      reset(state.collections);
    }
  }, [state, reset]);
  return <ReviewViewProvider value={store}>{children}</ReviewViewProvider>;
};
