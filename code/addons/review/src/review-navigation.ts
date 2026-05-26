import { REVIEW_CHANGES_URL } from './constants.ts';

export type ReviewTab = 'collections' | 'components';

// A detail-screen target: either a collection (indexed into state.collections)
// or a component group (keyed by component id). Both track a story index into
// their respective story list, so the same DetailsScreen drives both flows.
export type ReviewDetailLocation =
  | { kind: 'collection'; collectionIndex: number; storyIndex: number }
  | { kind: 'component'; componentId: string; storyIndex: number };

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
  const target =
    location.kind === 'collection'
      ? `&collection=${location.collectionIndex}`
      : `&component=${location.componentId}`;
  return `?path=${tabPath(tab)}${target}&story=${location.storyIndex}`;
};

// The summary tab the user last had open, carried through detail-page links
// so the back button returns them to the tab they came from.
export const parseReviewChangesActiveTab = (search: string): ReviewTab => {
  const params = new URLSearchParams(search);
  const path = params.get('path') ?? '';
  if (path.startsWith(`${REVIEW_CHANGES_URL}components`)) {
    return 'components';
  }
  // Back-compat for legacy review URLs that still encode the tab as `&tab=…`.
  if (params.get('tab') === 'components') {
    return 'components';
  }
  return 'collections';
};

// Parse a detail-screen target out of the URL. Returns null for the summary.
export const parseReviewChangesDetailLocation = (search: string): ReviewDetailLocation | null => {
  const params = new URLSearchParams(search);

  // URLSearchParams.get() returns null for a missing param, and Number(null)
  // is 0 — so every numeric param is null-checked before coercion, otherwise
  // an absent param would parse as 0 and wrongly force the detail screen.
  const storyParam = params.get('story');
  if (storyParam === null) {
    return null;
  }
  const storyIndex = Number(storyParam);
  if (!Number.isInteger(storyIndex) || storyIndex < 0) {
    return null;
  }

  const componentId = params.get('component');
  if (componentId) {
    return { kind: 'component', componentId, storyIndex };
  }

  const collectionParam = params.get('collection');
  if (collectionParam === null) {
    return null;
  }
  const collectionIndex = Number(collectionParam);
  if (!Number.isInteger(collectionIndex) || collectionIndex < 0) {
    return null;
  }
  return { kind: 'collection', collectionIndex, storyIndex };
};
