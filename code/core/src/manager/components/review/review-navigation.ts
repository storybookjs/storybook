import { queryFromLocation } from 'storybook/internal/router';

import { REVIEW_CHANGES_URL } from './constants.ts';
import type { ReviewState } from './review-state.ts';

/** Layout query param that collapses manager chrome during review. */
export const REVIEW_FULL_QUERY_PARAM = 'full';

const parseReviewLayoutFull = (value: unknown): boolean =>
  value === '1' || value === 'true' || value === 1 || value === true;

/** Fallback display name when the Storybook index has not resolved a title. */
export const prettifyComponentId = (componentId: string) =>
  componentId
    .split(/[-/]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

/** A single navigable slot in the flattened review list (duplicates allowed). */
export interface ReviewNavEntry {
  storyId: string;
  collectionIndex: number;
}

export const REVIEW_COLLECTION_QUERY_PARAM = 'collection';

export const buildReviewChangesSummaryHref = () =>
  `?${REVIEW_FULL_QUERY_PARAM}=1&path=${REVIEW_CHANGES_URL}`;

/** Plain manager href for navigating to a review story (includes `full=1`). */
export const buildReviewStoryNavigateHref = (entry: ReviewNavEntry): string =>
  `?${REVIEW_FULL_QUERY_PARAM}=1&path=/story/${entry.storyId}&${REVIEW_COLLECTION_QUERY_PARAM}=${entry.collectionIndex}`;

/** Default back target when no story has been visited yet. */
export const STORYBOOK_ROOT_HREF = '/';

export const buildSummaryBackHref = (returnSearch: string | null | undefined): string =>
  returnSearch || STORYBOOK_ROOT_HREF;

/** Strip review layout params so exit/history navigation restores normal chrome. */
export const stripReviewLayoutFromSearch = (search: string): string => {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  params.delete(REVIEW_FULL_QUERY_PARAM);
  params.delete(REVIEW_COLLECTION_QUERY_PARAM);
  const query = params.toString();
  return query ? `?${query}` : '';
};

/** Marks summary-header back links for SPA navigation in useReviewNavigationInterceptor. */
export const REVIEW_SUMMARY_BACK_ATTR = 'data-review-summary-back';

/** Full `?path=` href for a review story. */
export const buildReviewStoryHref = (entry: ReviewNavEntry): string =>
  buildReviewStoryNavigateHref(entry);

export const parseReviewStoryHref = (href: string): ReviewNavEntry | null => {
  const query = href.startsWith('?') ? href.slice(1) : href;
  const params = new URLSearchParams(query);
  const path = params.get('path');
  if (!path?.startsWith('/story/')) {
    return null;
  }
  const storyId = path.slice('/story/'.length);
  const collectionIndex = parseCollectionIndex(
    params.get(REVIEW_COLLECTION_QUERY_PARAM) ?? undefined
  );
  if (!storyId || collectionIndex === undefined) {
    return null;
  }
  return { storyId, collectionIndex };
};

/** Walk collections in order, pushing every story occurrence. */
export const buildFlattenedNavEntries = (state: ReviewState): ReviewNavEntry[] => {
  const entries: ReviewNavEntry[] = [];
  state.collections.forEach((collection, collectionIndex) => {
    for (const storyId of collection.storyIds) {
      entries.push({ storyId, collectionIndex });
    }
  });
  return entries;
};

export const isReviewSummaryPath = (path: string): boolean =>
  path === REVIEW_CHANGES_URL || path === '/review';

export const isReviewLayoutActive = (location?: { search?: string }): boolean =>
  parseReviewLayoutFull(queryFromLocation(location)[REVIEW_FULL_QUERY_PARAM]);

export const isReviewStoryRoute = (path: string, collectionParam: string | undefined): boolean =>
  parseStoryIdFromPath(path) !== null && parseCollectionIndex(collectionParam) !== undefined;

/** True when the route is part of the review flow (summary or curated story). */
export const isReviewRoute = (path: string, collectionParam: string | undefined): boolean =>
  isReviewSummaryPath(path) || isReviewStoryRoute(path, collectionParam);

/** True when a manager search string points back at a review route (not a canvas). */
export const isReviewReturnSearch = (search: string): boolean => {
  const path =
    new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('path') ?? '';
  return isReviewSummaryPath(path) || path.startsWith(REVIEW_CHANGES_URL);
};

export const parseStoryIdFromPath = (path: string): string | null => {
  if (!path.startsWith('/story/')) {
    return null;
  }
  const storyId = path.slice('/story/'.length);
  return storyId || null;
};

export const parseCollectionIndex = (value: string | undefined): number | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (!/^\d+$/.test(value)) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
};

/**
 * Resolve the active navigation slot from the current story and optional
 * `collection` query param. Falls back to the first matching storyId.
 */
export const resolveActiveNavEntry = (
  entries: ReviewNavEntry[],
  storyId: string,
  collectionIndex?: number
): ReviewNavEntry | null => {
  if (entries.length === 0) {
    return null;
  }
  if (collectionIndex !== undefined) {
    const exact = entries.find(
      (entry) => entry.storyId === storyId && entry.collectionIndex === collectionIndex
    );
    if (exact) {
      return exact;
    }
  }
  return entries.find((entry) => entry.storyId === storyId) ?? null;
};

export const resolveNavIndex = (entries: ReviewNavEntry[], active: ReviewNavEntry): number =>
  entries.findIndex(
    (entry) => entry.storyId === active.storyId && entry.collectionIndex === active.collectionIndex
  );

/** Previous/next targets in the flattened review sequence, wrapping at the ends. */
export const getAdjacentReviewEntries = (
  entries: readonly ReviewNavEntry[],
  index: number
): { previous: ReviewNavEntry; next: ReviewNavEntry } | null => {
  const total = entries.length;
  if (total === 0 || index < 0 || index >= total) {
    return null;
  }
  return {
    previous: entries[(index - 1 + total) % total],
    next: entries[(index + 1) % total],
  };
};

/** First story of the collection one step away, wrapping and skipping empty collections. */
export const getAdjacentCollectionFirstStory = (
  collections: readonly { storyIds: string[] }[],
  collectionIndex: number,
  direction: 1 | -1
): ReviewNavEntry | null => {
  const total = collections.length;
  if (total === 0) {
    return null;
  }
  for (let step = 1; step <= total; step += 1) {
    const index = (((collectionIndex + direction * step) % total) + total) % total;
    const candidate = collections[index];
    if (candidate && candidate.storyIds.length > 0) {
      return { collectionIndex: index, storyId: candidate.storyIds[0] };
    }
  }
  return null;
};

/** Keyboard shortcut targets for the active reviewed story, as ready-to-navigate hrefs. */
export interface ReviewShortcutHrefs {
  back: string;
  previous: string;
  next: string;
  previousCollection: string;
  nextCollection: string;
}

export const buildReviewShortcutHrefs = (
  collections: readonly { storyIds: string[] }[],
  entries: readonly ReviewNavEntry[],
  activeIndex: number
): ReviewShortcutHrefs | null => {
  if (activeIndex < 0 || entries.length === 0) {
    return null;
  }
  const active = entries[activeIndex];
  const neighbors = getAdjacentReviewEntries(entries, activeIndex);
  const fallback = active;
  const previousCollection =
    getAdjacentCollectionFirstStory(collections, active.collectionIndex, -1) ?? fallback;
  const nextCollection =
    getAdjacentCollectionFirstStory(collections, active.collectionIndex, 1) ?? fallback;

  return {
    back: buildReviewChangesSummaryHref(),
    previous: buildReviewStoryHref(neighbors?.previous ?? fallback),
    next: buildReviewStoryHref(neighbors?.next ?? fallback),
    previousCollection: buildReviewStoryHref(previousCollection),
    nextCollection: buildReviewStoryHref(nextCollection),
  };
};
