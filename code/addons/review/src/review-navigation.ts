import { REVIEW_CHANGES_URL } from './constants.ts';

// A detail-screen target: a collection (indexed into state.collections) and,
// optionally, the specific story within it that is being reviewed.
export interface ReviewDetailLocation {
  collectionIndex: number;
  storyId?: string;
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
