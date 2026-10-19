// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/client-logger';
import type { NavigateFunction } from 'storybook/internal/router';
import type { StoryIndex } from 'storybook/internal/types';
import type { API } from 'storybook/manager-api';

import { clearChannel, installNoopChannel } from '../../../channels/channel-slot.ts';
import { clearRegistry, getService } from '../../../shared/open-service/server.ts';
import { registerReviewService } from '../../../shared/open-service/services/review/server.ts';
import {
  NOTIFIED_REVIEW_CREATED_AT_KEY,
  VISITED_REVIEW_CREATED_AT_KEY,
  reviewAvailableNotificationId,
} from './constants.ts';
import { acceptPendingReview, dismissReview, navigateOutOfReview } from './review-actions.ts';
import { enterReviewMode, type ReviewModeHandle } from './review-mode.ts';
import {
  REVIEW_COLLECTION_QUERY_PARAM,
  buildReviewChangesSummaryHref,
} from './review-navigation.ts';
import type { ReviewState } from './review-state.ts';

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

const emptyIndex = { v: 5, entries: {} } as StoryIndex;
const getIndex = vi.fn<() => Promise<StoryIndex>>();

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

const makeMode = (initial = false): ReviewModeHandle => {
  let active = initial;
  return {
    isActive: () => active,
    setActive: (next: boolean) => {
      active = next;
    },
  };
};

beforeEach(() => {
  installNoopChannel();
  clearRegistry();
  getIndex.mockResolvedValue(emptyIndex);
  registerReviewService({ getIndex });
  sessionStorage.clear();
});

afterEach(() => {
  clearRegistry();
  clearChannel();
  vi.restoreAllMocks();
});

describe('navigateOutOfReview', () => {
  it('restores filters before navigating back to the canvas', async () => {
    const { api, setAllStatusFilters, setAllTagFilters } = makeApi();
    const mode = makeMode();
    const navigate = vi.fn();
    const order: string[] = [];

    await enterReviewMode(api, emptyFilters, mode);
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
      '?path=/story/example--default',
      mode
    );

    expect(order).toEqual(['restore-tag-filters', 'restore-status-filters', 'navigate']);
    expect(api.setQueryParams).toHaveBeenCalledWith({ [REVIEW_COLLECTION_QUERY_PARAM]: null });
    expect(api.selectFirstStory).not.toHaveBeenCalled();
    expect(mode.isActive()).toBe(false);
  });

  it('marks the visited review so the arrival toast does not re-fire', async () => {
    const { api } = makeApi();
    const navigate = vi.fn() as unknown as NavigateFunction;

    await navigateOutOfReview(api, navigate, '?path=/story/example--default', makeMode(), {
      visitCreatedAt: review.createdAt,
    });

    expect(sessionStorage.getItem(VISITED_REVIEW_CREATED_AT_KEY)).toBe(String(review.createdAt));
    expect(api.clearNotification).toHaveBeenCalledWith(
      reviewAvailableNotificationId(review.createdAt!)
    );
  });

  it('does not record a visit when no visited review is passed', async () => {
    const { api } = makeApi();
    const navigate = vi.fn() as unknown as NavigateFunction;

    await navigateOutOfReview(api, navigate, '?path=/story/example--default', makeMode());

    expect(sessionStorage.getItem(VISITED_REVIEW_CREATED_AT_KEY)).toBeNull();
    expect(sessionStorage.getItem(NOTIFIED_REVIEW_CREATED_AT_KEY)).toBeNull();
  });

  it('does not mark the review as visited when filter restoration fails', async () => {
    const { api, setAllTagFilters } = makeApi();
    const mode = makeMode();
    const navigate = vi.fn() as unknown as NavigateFunction;

    await enterReviewMode(api, emptyFilters, mode);
    vi.clearAllMocks();
    setAllTagFilters.mockRejectedValueOnce(new Error('restore failed'));

    await expect(
      navigateOutOfReview(api, navigate, '?path=/story/example--default', mode, {
        visitCreatedAt: review.createdAt,
      })
    ).rejects.toThrow('restore failed');

    expect(sessionStorage.getItem(VISITED_REVIEW_CREATED_AT_KEY)).toBeNull();
    expect(api.clearNotification).not.toHaveBeenCalled();
  });

  it('signals the exit transition around the navigation, including on failure', async () => {
    const { api, setAllTagFilters } = makeApi();
    const mode = makeMode();
    const navigate = vi.fn() as unknown as NavigateFunction;
    const onExitingChange = vi.fn();

    await enterReviewMode(api, emptyFilters, mode);
    setAllTagFilters.mockRejectedValueOnce(new Error('restore failed'));

    await expect(
      navigateOutOfReview(api, navigate, '?path=/story/example--default', mode, {
        onExitingChange,
      })
    ).rejects.toThrow('restore failed');

    expect(onExitingChange.mock.calls).toEqual([[true], [false]]);
  });

  it('falls back to the first story when the return search points at a review route', async () => {
    const { api } = makeApi();
    const navigate = vi.fn() as unknown as NavigateFunction;

    await navigateOutOfReview(
      api,
      navigate,
      `?path=/story/story--default&${REVIEW_COLLECTION_QUERY_PARAM}=0`,
      makeMode()
    );

    expect(navigate).not.toHaveBeenCalled();
    expect(api.selectFirstStory).toHaveBeenCalled();
  });
});

describe('dismissReview', () => {
  it('clears the review through the service command', async () => {
    const dismiss = vi
      .spyOn(getService('core/review', { internal: true }).commands, 'dismissReview')
      .mockResolvedValue(undefined);

    await dismissReview();

    expect(dismiss).toHaveBeenCalledWith(undefined);
  });

  it('handles command failure without an unhandled rejection', async () => {
    const failure = new Error('remote dismissal timed out');
    vi.spyOn(
      getService('core/review', { internal: true }).commands,
      'dismissReview'
    ).mockRejectedValue(failure);
    const logError = vi.spyOn(logger, 'error').mockImplementation(() => {});

    await expect(dismissReview()).resolves.toBeUndefined();

    expect(logError).toHaveBeenCalledWith('Failed to dismiss review', failure);
  });
});

describe('acceptPendingReview', () => {
  const pending: ReviewState = {
    ...review,
    title: 'Updated review',
    createdAt: review.createdAt! + 60_000,
  };

  it('is a no-op when nothing is pending', async () => {
    const { api } = makeApi();
    const navigate = vi.fn() as unknown as NavigateFunction;
    const acceptPending = vi.spyOn(
      getService('core/review', { internal: true }).commands,
      'acceptPending'
    );

    await acceptPendingReview(api, navigate, emptyFilters, makeMode(), null);

    expect(acceptPending).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(api.clearNotification).not.toHaveBeenCalled();
  });

  it('promotes the pending review through the service, enters review mode and navigates', async () => {
    const { api } = makeApi();
    const mode = makeMode();
    const navigate = vi.fn() as unknown as NavigateFunction;
    const acceptPending = vi.spyOn(
      getService('core/review', { internal: true }).commands,
      'acceptPending'
    );

    await acceptPendingReview(api, navigate, emptyFilters, mode, pending);

    expect(acceptPending).toHaveBeenCalledWith(undefined);
    expect(mode.isActive()).toBe(true);
    expect(api.clearNotification).toHaveBeenCalledWith(
      reviewAvailableNotificationId(pending.createdAt!)
    );
    expect(sessionStorage.getItem(VISITED_REVIEW_CREATED_AT_KEY)).toBe(String(pending.createdAt));
    expect(navigate).toHaveBeenCalledWith(buildReviewChangesSummaryHref(), { plain: true });
  });

  it('does not enter review mode or navigate when the accept command fails', async () => {
    const failure = new Error('remote accept timed out');
    const { api } = makeApi();
    const mode = makeMode();
    const navigate = vi.fn() as unknown as NavigateFunction;
    vi.spyOn(
      getService('core/review', { internal: true }).commands,
      'acceptPending'
    ).mockRejectedValue(failure);
    const logError = vi.spyOn(logger, 'error').mockImplementation(() => {});

    await expect(
      acceptPendingReview(api, navigate, emptyFilters, mode, pending)
    ).resolves.toBeUndefined();

    expect(mode.isActive()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith('Failed to accept pending review', failure);
  });
});
