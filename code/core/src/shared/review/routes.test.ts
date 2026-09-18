import { describe, expect, it } from 'vitest';

import {
  isReviewCollectionStoryRoute,
  isReviewManagerRoute,
  isReviewSummaryPath,
} from './routes.ts';

describe('isReviewSummaryPath', () => {
  it('matches the review summary routes', () => {
    expect(isReviewSummaryPath('/review/')).toBe(true);
    expect(isReviewSummaryPath('/review')).toBe(true);
    expect(isReviewSummaryPath('/story/foo--bar')).toBe(false);
  });
});

describe('isReviewCollectionStoryRoute', () => {
  it('matches only story routes with a collection query param', () => {
    expect(isReviewCollectionStoryRoute('/story/foo--bar', { collection: '0' })).toBe(true);
    expect(isReviewCollectionStoryRoute('/story/foo--bar', {})).toBe(false);
    expect(isReviewCollectionStoryRoute('/review/', { collection: '0' })).toBe(false);
    expect(isReviewCollectionStoryRoute(undefined, { collection: '0' })).toBe(false);
  });
});

describe('isReviewManagerRoute', () => {
  it('matches the summary and curated review story routes', () => {
    expect(isReviewManagerRoute('/review/')).toBe(true);
    expect(isReviewManagerRoute('/story/foo--bar', { collection: '0' })).toBe(true);
  });

  it('does not match normal canvas routes', () => {
    expect(isReviewManagerRoute(undefined)).toBe(false);
    expect(isReviewManagerRoute('/story/foo--bar')).toBe(false);
    expect(isReviewManagerRoute('/docs/foo--bar')).toBe(false);
    expect(isReviewManagerRoute('/settings/about')).toBe(false);
  });
});
