export const REVIEW_COLLECTION_QUERY_PARAM = 'collection';

export const isReviewSummaryPath = (path: string): boolean =>
  path === '/review/' || path === '/review';

/** True when the manager URL targets the review summary or a curated review story. */
export const isReviewManagerRoute = (
  path: string,
  customQueryParams?: Readonly<Record<string, string | undefined>> | null
): boolean =>
  isReviewSummaryPath(path) ||
  path.startsWith('/review/') ||
  (path.startsWith('/story/') && customQueryParams?.[REVIEW_COLLECTION_QUERY_PARAM] !== undefined);
