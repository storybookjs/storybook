// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StatusValue } from 'storybook/internal/types';

import {
  enterReviewMode,
  exitReviewMode,
  isReviewModeActive,
  type ReviewModeFilters,
} from './review-mode.ts';
import { REVIEWING_STATUS_VALUE } from './review-status.ts';
import { reviewStore } from './review-store.ts';

const emptyFilters: ReviewModeFilters = {
  includedStatusFilters: [],
  excludedStatusFilters: [],
  includedTagFilters: [],
  excludedTagFilters: [],
};

const makeApi = () => ({
  setAllStatusFilters: vi.fn(async () => {}),
  setAllTagFilters: vi.fn(async () => {}),
  removeStatusFilters: vi.fn(async () => {}),
});

beforeEach(() => {
  sessionStorage.clear();
  reviewStore.reset();
});

describe('enterReviewMode', () => {
  it('narrows filters to reviewing and sets the flag without changing chrome', async () => {
    const api = makeApi();
    await enterReviewMode(api, emptyFilters);

    expect(api.setAllTagFilters).toHaveBeenCalledWith([], []);
    expect(api.setAllStatusFilters).toHaveBeenCalledWith(['status-value:reviewing'], []);
    expect(isReviewModeActive()).toBe(true);
  });

  it('snapshots the pre-review filters only on the first entry', async () => {
    const preReviewFilters: ReviewModeFilters = {
      includedStatusFilters: ['status-value:error' as StatusValue],
      excludedStatusFilters: [],
      includedTagFilters: ['play-fn'],
      excludedTagFilters: [],
    };
    await enterReviewMode(makeApi(), preReviewFilters);
    // A second (idempotent) entry with different filters must not overwrite the snapshot.
    await enterReviewMode(makeApi(), emptyFilters);

    const api = makeApi();
    await exitReviewMode(api);
    expect(api.setAllTagFilters).toHaveBeenCalledWith(['play-fn'], []);
    expect(api.setAllStatusFilters).toHaveBeenCalledWith(['status-value:error'], []);
  });

  it('does not re-apply filters when already in review mode', async () => {
    const api = makeApi();
    await enterReviewMode(api, emptyFilters);
    vi.clearAllMocks();
    await enterReviewMode(api, emptyFilters);
    expect(api.setAllTagFilters).not.toHaveBeenCalled();
    expect(api.setAllStatusFilters).not.toHaveBeenCalled();
  });

  it('rolls back the review-mode flag when the filter setters fail', async () => {
    const api = makeApi();
    api.setAllTagFilters.mockRejectedValueOnce(new Error('boom'));
    await expect(enterReviewMode(api, emptyFilters)).rejects.toThrow('boom');
    expect(isReviewModeActive()).toBe(false);
  });

  it('omits reviewing from the snapshot even when the current filters include it', async () => {
    const api = makeApi();
    await enterReviewMode(api, {
      ...emptyFilters,
      includedStatusFilters: ['status-value:error' as StatusValue, REVIEWING_STATUS_VALUE],
    });

    const exitApi = makeApi();
    await exitReviewMode(exitApi);
    expect(exitApi.setAllStatusFilters).toHaveBeenCalledWith(['status-value:error'], []);
  });
});

describe('exitReviewMode', () => {
  it('restores snapshotted filters and clears the flag', async () => {
    const preReviewFilters: ReviewModeFilters = {
      includedStatusFilters: ['status-value:error' as StatusValue],
      excludedStatusFilters: [],
      includedTagFilters: ['play-fn'],
      excludedTagFilters: [],
    };
    await enterReviewMode(makeApi(), preReviewFilters);

    const api = makeApi();
    await exitReviewMode(api);
    expect(api.setAllTagFilters).toHaveBeenCalledWith(['play-fn'], []);
    expect(api.setAllStatusFilters).toHaveBeenCalledWith(['status-value:error'], []);
    expect(isReviewModeActive()).toBe(false);
  });

  it('is inert when there is no snapshot to restore', async () => {
    const api = makeApi();
    await exitReviewMode(api);
    expect(api.setAllTagFilters).not.toHaveBeenCalled();
    expect(api.setAllStatusFilters).not.toHaveBeenCalled();
    expect(api.removeStatusFilters).toHaveBeenCalledWith([REVIEWING_STATUS_VALUE]);
    expect(isReviewModeActive()).toBe(false);
  });

  it('never restores the reviewing status filter', async () => {
    await enterReviewMode(makeApi(), {
      ...emptyFilters,
      includedStatusFilters: ['status-value:error' as StatusValue],
    });

    const api = makeApi();
    await exitReviewMode(api);
    expect(api.setAllStatusFilters).toHaveBeenCalledWith(['status-value:error'], []);
    expect(api.setAllStatusFilters).not.toHaveBeenCalledWith(
      expect.arrayContaining([REVIEWING_STATUS_VALUE]),
      expect.anything()
    );
  });
});
