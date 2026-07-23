// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/client-logger';
import type { NavigateFunction } from 'storybook/internal/router';
import type { API } from 'storybook/manager-api';

import { clearChannel, installNoopChannel } from '../../../channels/channel-slot.ts';
import { clearRegistry, getService } from '../../../shared/open-service/server.ts';
import { registerReviewService } from '../../../shared/open-service/services/review/server.ts';
import {
  EVENTS,
  NOTIFIED_REVIEW_CREATED_AT_KEY,
  PRE_REVIEW_RETURN_KEY,
  VISITED_REVIEW_CREATED_AT_KEY,
  reviewAvailableNotificationId,
} from './constants.ts';
import { acceptPendingReview, dismissReview, navigateOutOfReview } from './review-actions.ts';
import { enterReviewMode, isReviewModeActive } from './review-mode.ts';
import {
  REVIEW_COLLECTION_QUERY_PARAM,
  buildReviewChangesSummaryHref,
} from './review-navigation.ts';
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
  installNoopChannel();
  clearRegistry();
  registerReviewService();
  sessionStorage.clear();
  reviewStore.reset();
});

afterEach(() => {
  clearRegistry();
  clearChannel();
  vi.restoreAllMocks();
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

    reviewStore.displayReview(review);

    await navigateOutOfReview(api, navigate, '?path=/story/example--default');

    expect(sessionStorage.getItem(VISITED_REVIEW_CREATED_AT_KEY)).toBe(String(review.createdAt));
    expect(api.clearNotification).toHaveBeenCalledWith(
      reviewAvailableNotificationId(review.createdAt!)
    );
  });

  it('does not record a visit when dismissing the review', async () => {
    const { api } = makeApi();
    const navigate = vi.fn() as unknown as NavigateFunction;

    reviewStore.displayReview(review);

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

    reviewStore.displayReview(review);

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

describe('dismissReview', () => {
  it('emits navigation only after the OSA dismissal command resolves', async () => {
    sessionStorage.setItem(PRE_REVIEW_RETURN_KEY, '?path=/story/example--default');
    const emit = vi.fn();
    let resolveCommand!: () => void;
    vi.spyOn(getService('core/review').commands, 'dismissReview').mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCommand = resolve;
        })
    );

    const dismissal = dismissReview({ emit } as unknown as API);

    expect(emit).not.toHaveBeenCalled();
    resolveCommand();
    await dismissal;

    expect(emit).toHaveBeenCalledWith(EVENTS.DISMISS_REVIEW, '?path=/story/example--default');
  });

  it('handles command failure without navigation or an unhandled rejection', async () => {
    const failure = new Error('remote dismissal timed out');
    const emit = vi.fn();
    vi.spyOn(getService('core/review').commands, 'dismissReview').mockRejectedValue(failure);
    const logError = vi.spyOn(logger, 'error').mockImplementation(() => {});

    await expect(dismissReview({ emit } as unknown as API)).resolves.toBeUndefined();

    expect(emit).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith('Failed to dismiss review', failure);
  });
});

describe('acceptPendingReview', () => {
  const pending: ReviewState = {
    ...review,
    title: 'Updated review',
    createdAt: review.createdAt! + 60_000,
  };

  it('is a no-op when nothing is pending', () => {
    const { api } = makeApi();
    const navigate = vi.fn() as unknown as NavigateFunction;

    acceptPendingReview(api, navigate, emptyFilters);

    expect(navigate).not.toHaveBeenCalled();
    expect(api.clearNotification).not.toHaveBeenCalled();
  });

  it('displays the pending review, enters review mode and navigates to the summary', () => {
    const { api } = makeApi();
    const navigate = vi.fn() as unknown as NavigateFunction;
    reviewStore.displayReview(review);
    reviewStore.deferReview(pending);

    acceptPendingReview(api, navigate, emptyFilters);

    expect(reviewStore.getState().state).toBe(pending);
    expect(reviewStore.getState().pendingReview).toBeNull();
    expect(isReviewModeActive()).toBe(true);
    expect(api.clearNotification).toHaveBeenCalledWith(
      reviewAvailableNotificationId(pending.createdAt!)
    );
    expect(sessionStorage.getItem(VISITED_REVIEW_CREATED_AT_KEY)).toBe(String(pending.createdAt));
    expect(navigate).toHaveBeenCalledWith(buildReviewChangesSummaryHref(), { plain: true });
  });
});
