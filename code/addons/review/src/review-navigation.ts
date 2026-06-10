import { REVIEW_CHANGES_URL } from './constants.ts';
import type { ReviewState } from './review-state.ts';

/** Fallback display name when the Storybook index has not resolved a title. */
export const prettifyComponentId = (componentId: string) =>
  componentId
    .split(/[-/]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const tryDecodeURIComponent = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/** Normalize preview URLs or encoded ids down to a plain story id. */
export const normalizeReviewStoryId = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  const shouldTreatAsUrl =
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/iframe.html') ||
    trimmed.startsWith('iframe.html') ||
    trimmed.startsWith('./iframe.html');

  if (shouldTreatAsUrl) {
    try {
      const url = new URL(trimmed, 'https://storybook.local');
      const id = url.searchParams.get('id');
      if (id) {
        return tryDecodeURIComponent(id);
      }
    } catch {
      // Fall through to the regex-based extraction below.
    }
  }

  const queryIdMatch = trimmed.match(/(?:^|[?&])id=([^&#]+)/);
  if (queryIdMatch?.[1]) {
    return tryDecodeURIComponent(queryIdMatch[1]);
  }

  return trimmed;
};

/** Preview iframe URL for a story thumbnail. */
export const storyPreviewUrl = (storyId: string, { freeze = false }: { freeze?: boolean } = {}) =>
  `iframe.html?id=${encodeURIComponent(storyId)}&viewMode=story${freeze ? '&freeze=finished' : ''}`;

/** Link to a story in the regular Storybook manager. */
export const buildStorybookStoryHref = (storyId: string): string =>
  `?path=/story/${encodeURIComponent(normalizeReviewStoryId(storyId))}`;

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

/** Previous/next targets in the flattened review sequence, wrapping at the ends. */
export const getReviewDetailNeighbors = (
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
  const neighbors = getReviewDetailNeighbors(entries, activeIndex);
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
