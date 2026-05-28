import { REVIEW_CHANGES_URL } from './constants.ts';

export type ReviewTab = 'collections' | 'components';

// A detail-screen target: either a collection (indexed into state.collections)
// or a component grouping selected by a unique storyId.
export type ReviewDetailLocation =
  | { kind: 'collection'; collectionIndex: number; storyId?: string }
  | { kind: 'component'; storyId: string };

const tabPath = (tab: ReviewTab = 'collections') => `${REVIEW_CHANGES_URL}${tab}`;

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
    const target = location.storyId ? `${base}/${encodeURIComponent(location.storyId)}` : base;
    return `?path=${target}`;
  }
  const base = tabPath(tab);
  const target = `${base}/${encodeURIComponent(location.storyId)}`;
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
    const storySegment = segments[1];
    return {
      kind: 'collection',
      collectionIndex,
      storyId: storySegment ? decodeURIComponent(storySegment) : undefined,
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
      storyId: decodeURIComponent(firstSegment),
    };
  }
  return null;
};
