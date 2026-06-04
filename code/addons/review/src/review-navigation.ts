import { REVIEW_CHANGES_URL } from './constants.ts';

export type ReviewTab = 'collections' | 'components';

// A detail-screen target: either a collection (indexed into state.collections)
// or a component grouping selected by a unique storyId.
export type ReviewDetailLocation =
  | { kind: 'collection'; collectionIndex: number; storyId?: string }
  | { kind: 'component'; storyId: string };

const tabPath = (tab: ReviewTab = 'collections') => `${REVIEW_CHANGES_URL}${tab}`;

const tryDecodeURIComponent = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

// Defensive normalization for callers that accidentally provide a preview URL
// (`iframe.html?id=...`) instead of a plain story id (`button--primary`).
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

// Storybook's manager router keeps the active route in the `path` query param
// (see core/src/router) — `Route`/`api.navigate` read `?path=…`, not
// window.location.pathname. Hrefs therefore wrap the route in `?path=…` and
// keep collection/component/story as sibling params.
export const buildReviewChangesSummaryHref = (tab: ReviewTab = 'collections') =>
  `?path=${tabPath(tab)}`;

export const buildReviewChangesDetailHref = (
  location: ReviewDetailLocation,
  tab: ReviewTab = 'collections'
): string => {
  if (location.kind === 'collection') {
    const base = `${tabPath(tab)}/${location.collectionIndex}`;
    const target = location.storyId
      ? `${base}/${encodeURIComponent(normalizeReviewStoryId(location.storyId))}`
      : base;
    return `?path=${target}`;
  }
  const base = tabPath(tab);
  const target = `${base}/${encodeURIComponent(normalizeReviewStoryId(location.storyId))}`;
  return `?path=${target}`;
};

// The summary tab the user last had open, carried through detail-page links
// so the back button returns them to the tab they came from.
export const parseReviewChangesActiveTab = (search: string): ReviewTab => {
  const params = new URLSearchParams(search);
  const path = params.get('path') ?? '';
  if (path.startsWith(`${REVIEW_CHANGES_URL}components`)) {
    return 'components';
  }
  return 'collections';
};

// Parse a detail-screen target out of the URL. Returns null for the summary.
export const parseReviewChangesDetailLocation = (search: string): ReviewDetailLocation | null => {
  const params = new URLSearchParams(search);
  const path = params.get('path') ?? '';

  if (path.startsWith(`${REVIEW_CHANGES_URL}collections/`)) {
    const segments = path.slice(`${REVIEW_CHANGES_URL}collections/`.length).split('/');
    const collectionParam = segments[0];
    const collectionIndex = Number(collectionParam);
    if (!Number.isInteger(collectionIndex) || collectionIndex < 0) {
      return null;
    }
    // Reject trailing junk (e.g. `collections/0/story/extra`) so the route is
    // parsed as strictly as the components route below.
    if (segments.length > 2 && segments[2]) {
      return null;
    }
    const storySegment = segments[1];
    return {
      kind: 'collection',
      collectionIndex,
      storyId: storySegment
        ? normalizeReviewStoryId(tryDecodeURIComponent(storySegment))
        : undefined,
    };
  }

  if (path.startsWith(`${REVIEW_CHANGES_URL}components/`)) {
    const segments = path.slice(`${REVIEW_CHANGES_URL}components/`.length).split('/');
    const firstSegment = segments[0];
    if (!firstSegment) {
      return null;
    }
    if (segments.length > 1 && segments[1]) {
      return null;
    }
    return {
      kind: 'component',
      storyId: normalizeReviewStoryId(tryDecodeURIComponent(firstSegment)),
    };
  }
  return null;
};
