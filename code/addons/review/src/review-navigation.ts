import { REVIEW_CHANGES_URL } from './constants.ts';
import type { ReviewState } from './review-state.ts';

/** A single navigable slot in the flattened review list (duplicates allowed). */
export interface ReviewNavEntry {
  storyId: string;
  collectionIndex: number;
}

export const REVIEW_COLLECTION_QUERY_PARAM = 'collection';

export const buildReviewChangesSummaryHref = () => `?path=${REVIEW_CHANGES_URL}`;

export const buildReviewStoryHref = (entry: ReviewNavEntry): string =>
  `?path=/story/${entry.storyId}&${REVIEW_COLLECTION_QUERY_PARAM}=${entry.collectionIndex}`;

/** Storybook manager navigate target (without the leading `?path=` wrapper). */
export const buildReviewStoryNavigationTarget = (entry: ReviewNavEntry): string =>
  `/story/${entry.storyId}&${REVIEW_COLLECTION_QUERY_PARAM}=${entry.collectionIndex}`;

export const parseReviewStoryHref = (href: string): ReviewNavEntry | null => {
  if (!href.startsWith('?path=/story/')) {
    return null;
  }
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
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
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

export const isStoryInReview = (entries: ReviewNavEntry[], storyId: string): boolean =>
  entries.some((entry) => entry.storyId === storyId);
