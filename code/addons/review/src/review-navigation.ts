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
// window.location.pathname. Hrefs therefore wrap the route in `?path=…`.
export const buildReviewChangesSummaryHref = () => `?path=${REVIEW_CHANGES_URL}`;

export const buildReviewChangesDetailHref = (location: ReviewDetailLocation): string => {
  const base = `${REVIEW_CHANGES_URL}${location.collectionIndex}`;
  const target = location.storyId
    ? `${base}/${encodeURIComponent(normalizeReviewStoryId(location.storyId))}`
    : base;
  return `?path=${target}`;
};

// Preview iframe URL for a story. Pass `freeze: true` to append the
// `freeze=finished` contract read by the core story freezer
// (setupStoryFreezer.shouldFreeze), which settles the preview to a static end
// frame and blocks interaction. Only the summary thumbnails want this; the
// detail screen must stay interactive, so freezing is opt-in.
export const storyPreviewUrl = (storyId: string, { freeze = false }: { freeze?: boolean } = {}) =>
  `iframe.html?id=${encodeURIComponent(storyId)}&viewMode=story${freeze ? '&freeze=finished' : ''}`;

// Link to a story in the regular Storybook manager. Kept under `/story/` so the
// review page's SPA click handler (which only captures `/review/` links) lets it
// through as a normal navigation.
export const buildStorybookStoryHref = (storyId: string): string =>
  `?path=/story/${encodeURIComponent(normalizeReviewStoryId(storyId))}`;

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
    storyId: storySegment ? normalizeReviewStoryId(tryDecodeURIComponent(storySegment)) : undefined,
  };
};
