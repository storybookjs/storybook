export const REVIEW_COLLECTION_QUERY_PARAM = 'collection';

export const isReviewSummaryPath = (path: string): boolean =>
  path === '/review/' || path === '/review';

/** True when the manager URL targets a story opened from a review collection. */
export const isReviewCollectionStoryRoute = (
  path: string | undefined,
  customQueryParams?: Readonly<Record<string, string | undefined>> | null
): boolean =>
  !!path &&
  path.startsWith('/story/') &&
  customQueryParams?.[REVIEW_COLLECTION_QUERY_PARAM] !== undefined;

/** True when the manager URL targets the review summary or a curated review story. */
export const isReviewManagerRoute = (
  path: string | undefined,
  customQueryParams?: Readonly<Record<string, string | undefined>> | null
): boolean =>
  !!path &&
  (isReviewSummaryPath(path) ||
    path.startsWith('/review/') ||
    isReviewCollectionStoryRoute(path, customQueryParams));
