import { REVIEW_CHANGES_URL } from './constants.ts';

// A detail-screen target: a collection (indexed into state.collections) and,
// optionally, the specific story within it that is being reviewed.
export interface ReviewDetailLocation {
  collectionIndex: number;
  storyId?: string;
}

// A position in the flattened review sequence: every collection's stories
// concatenated in collection order. The detail screen walks this sequence so
// prev/next move across collection boundaries instead of cycling within one.
export interface ReviewSequenceEntry {
  collectionIndex: number;
  storyId: string;
}

export const flattenReviewStories = (
  collections: readonly { storyIds: string[] }[]
): ReviewSequenceEntry[] =>
  collections.flatMap((collection, collectionIndex) =>
    collection.storyIds.map((storyId) => ({ collectionIndex, storyId }))
  );

// Previous/next targets for the detail screen, wrapping around the ends of the
// flattened sequence. `globalIndex` is the current story's position in
// `sequence`. Returns null for an empty sequence or out-of-range index so the
// caller can fall back gracefully.
export const getReviewDetailNeighbors = (
  sequence: readonly ReviewSequenceEntry[],
  globalIndex: number
): { previous: ReviewSequenceEntry; next: ReviewSequenceEntry } | null => {
  const total = sequence.length;
  if (total === 0 || globalIndex < 0 || globalIndex >= total) {
    return null;
  }
  return {
    previous: sequence[(globalIndex - 1 + total) % total],
    next: sequence[(globalIndex + 1) % total],
  };
};

// The first story of the collection `direction` steps away from
// `collectionIndex` (1 = next, -1 = previous), wrapping around and skipping
// empty collections. Used by the up/down keyboard shortcuts to jump whole
// collections. Returns null when no collection has any stories.
export const getAdjacentCollectionFirstStory = (
  collections: readonly { storyIds: string[] }[],
  collectionIndex: number,
  direction: 1 | -1
): ReviewSequenceEntry | null => {
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

// The detail screen's keyboard targets, as ready-to-navigate hrefs. Held by
// ReviewPage and read by the registered addon-shortcut actions to drive
// cross-collection navigation (back / prev-next story / prev-next collection).
export interface ReviewShortcutHrefs {
  back: string;
  previous: string;
  next: string;
  previousCollection: string;
  nextCollection: string;
}

const tryDecodeURIComponent = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

// Storybook's manager router keeps the active route in the `path` query param
// (see core/src/router) — `Route`/`api.navigate` read `?path=…`, not
// window.location.pathname. Hrefs therefore wrap the route in `?path=…`.
export const buildReviewChangesSummaryHref = () => `?path=${REVIEW_CHANGES_URL}`;

export const buildReviewChangesDetailHref = (location: ReviewDetailLocation): string => {
  const base = `${REVIEW_CHANGES_URL}${location.collectionIndex}`;
  const target = location.storyId ? `${base}/${encodeURIComponent(location.storyId)}` : base;
  return `?path=${target}`;
};

// Parse a detail-screen target out of the URL. Returns null for the summary.
export const parseReviewChangesDetailLocation = (search: string): ReviewDetailLocation | null => {
  const params = new URLSearchParams(search);
  const path = params.get('path') ?? '';

  if (!path.startsWith(REVIEW_CHANGES_URL)) {
    return null;
  }

  const segments = path.slice(REVIEW_CHANGES_URL.length).split('/').filter(Boolean);
  if (segments.length === 0) {
    return null;
  }

  const collectionIndex = Number(segments[0]);
  if (!Number.isInteger(collectionIndex) || collectionIndex < 0) {
    return null;
  }
  // Reject trailing junk (e.g. `0/story/extra`) so the route parses strictly.
  if (segments.length > 2) {
    return null;
  }

  const storySegment = segments[1];
  return {
    collectionIndex,
    storyId: storySegment ? tryDecodeURIComponent(storySegment) : undefined,
  };
};
