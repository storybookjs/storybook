// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NavigateFunction } from 'storybook/internal/router';
import type { API } from 'storybook/manager-api';

import {
  NOTIFIED_REVIEW_CREATED_AT_KEY,
  VISITED_REVIEW_CREATED_AT_KEY,
  reviewAvailableNotificationId,
} from './constants.ts';
import { navigateOutOfReview } from './review-actions.ts';
import { enterReviewMode } from './review-mode.ts';
import { REVIEW_COLLECTION_QUERY_PARAM } from './review-navigation.ts';
import type { ReviewState } from './review-state.ts';
import { reviewStore } from './review-store.ts';

const review: ReviewState = {
  title: 'Example review',
  description: '',
  createdAt: 1_700_000_000_000,
  collections: [{ title: 'A', rationale: '', storyIds: ['story--default'] }],
};

const emptyFilters = {
  includedStatusFilters: [],
  excludedStatusFilters: [],
  includedTagFilters: [],
  excludedTagFilters: [],
};

const makeApi = () => {
  const setAllStatusFilters = vi.fn(async () => {});
  const setAllTagFilters = vi.fn(async () => {});
  return {
    api: {
      setAllStatusFilters,
      setAllTagFilters,
      removeStatusFilters: vi.fn(async () => {}),
      setQueryParams: vi.fn(),
      selectFirstStory: vi.fn(),
      clearNotification: vi.fn(),
    } as unknown as API,
    setAllStatusFilters,
    setAllTagFilters,
  };
};

beforeEach(() => {
  sessionStorage.clear();
  reviewStore.reset();
});

describe('navigateOutOfReview', () => {
  it('restores filters before navigating back to the canvas', async () => {
    const { api, setAllStatusFilters, setAllTagFilters } = makeApi();
    const navigate = vi.fn();
    const order: string[] = [];

    setAllTagFilters.mockImplementation(async () => {
      order.push('restore-tag-filters');
    });
    setAllStatusFilters.mockImplementation(async () => {
      order.push('restore-status-filters');
    });
    navigate.mockImplementation(() => {
      order.push('navigate');
    });

    await enterReviewMode(api, emptyFilters);
    order.length = 0;
    vi.clearAllMocks();
    setAllTagFilters.mockImplementation(async () => {
      order.push('restore-tag-filters');
    });
    setAllStatusFilters.mockImplementation(async () => {
      order.push('restore-status-filters');
    });
    navigate.mockImplementation(() => {
      order.push('navigate');
    });

    await navigateOutOfReview(
      api,
      navigate as unknown as NavigateFunction,
      '?path=/story/example--default'
    );

    expect(order).toEqual(['restore-tag-filters', 'restore-status-filters', 'navigate']);
    expect(api.setQueryParams).toHaveBeenCalledWith({ [REVIEW_COLLECTION_QUERY_PARAM]: null });
    expect(api.selectFirstStory).not.toHaveBeenCalled();
  });

  it('marks the displayed review as visited so the arrival toast does not re-fire', async () => {
    const { api } = makeApi();
    const navigate = vi.fn() as unknown as NavigateFunction;

    reviewStore.setState(
      {
        ...reviewStore.getState(),
        state: review,
      },
      null
    );

    await navigateOutOfReview(api, navigate, '?path=/story/example--default');

    expect(sessionStorage.getItem(VISITED_REVIEW_CREATED_AT_KEY)).toBe(String(review.createdAt));
    expect(api.clearNotification).toHaveBeenCalledWith(
      reviewAvailableNotificationId(review.createdAt!)
    );
  });

  it('does not record a visit when dismissing the review', async () => {
    const { api } = makeApi();
    const navigate = vi.fn() as unknown as NavigateFunction;

    reviewStore.setState(
      {
        ...reviewStore.getState(),
        state: review,
      },
      null
    );

    await navigateOutOfReview(api, navigate, '?path=/story/example--default', {
      recordVisit: false,
    });

    expect(sessionStorage.getItem(VISITED_REVIEW_CREATED_AT_KEY)).toBeNull();
    expect(sessionStorage.getItem(NOTIFIED_REVIEW_CREATED_AT_KEY)).toBeNull();
  });

  it('does not mark the review as visited when filter restoration fails', async () => {
    const { api, setAllTagFilters } = makeApi();
    const navigate = vi.fn() as unknown as NavigateFunction;

    await enterReviewMode(api, emptyFilters);
    vi.clearAllMocks();
    setAllTagFilters.mockRejectedValueOnce(new Error('restore failed'));

    reviewStore.setState(
      {
        ...reviewStore.getState(),
        state: review,
      },
      null
    );

    await expect(
      navigateOutOfReview(api, navigate, '?path=/story/example--default')
    ).rejects.toThrow('restore failed');

    expect(sessionStorage.getItem(VISITED_REVIEW_CREATED_AT_KEY)).toBeNull();
    expect(api.clearNotification).not.toHaveBeenCalled();
  });

  it('falls back to the first story when the return search points at a review route', async () => {
    const { api } = makeApi();
    const navigate = vi.fn() as unknown as NavigateFunction;

    await navigateOutOfReview(
      api,
      navigate,
      `?path=/story/story--default&${REVIEW_COLLECTION_QUERY_PARAM}=0`
    );

    expect(navigate).not.toHaveBeenCalled();
    expect(api.selectFirstStory).toHaveBeenCalled();
  });
});
