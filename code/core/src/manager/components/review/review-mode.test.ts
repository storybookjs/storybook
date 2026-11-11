// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StatusValue } from 'storybook/internal/types';

import {
  enterReviewMode,
  exitReviewMode,
  type ReviewModeFilters,
  type ReviewModeHandle,
} from './review-mode.ts';
import { REVIEWING_STATUS_VALUE } from './review-status.ts';

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
  sessionStorage.clear();
});

describe('enterReviewMode', () => {
  it('narrows filters to reviewing and sets the flag without changing chrome', async () => {
    const api = makeApi();
    const mode = makeMode();
    await enterReviewMode(api, emptyFilters, mode);

    expect(api.setAllTagFilters).toHaveBeenCalledWith([], []);
    expect(api.setAllStatusFilters).toHaveBeenCalledWith(['status-value:reviewing'], []);
    expect(mode.isActive()).toBe(true);
  });

  it('snapshots the pre-review filters only on the first entry', async () => {
    const mode = makeMode();
    const preReviewFilters: ReviewModeFilters = {
      includedStatusFilters: ['status-value:error' as StatusValue],
      excludedStatusFilters: [],
      includedTagFilters: ['play-fn'],
      excludedTagFilters: [],
    };
    await enterReviewMode(makeApi(), preReviewFilters, mode);
    // A second (idempotent) entry with different filters must not overwrite the snapshot.
    await enterReviewMode(makeApi(), emptyFilters, mode);

    const api = makeApi();
    await exitReviewMode(api, mode);
    expect(api.setAllTagFilters).toHaveBeenCalledWith(['play-fn'], []);
    expect(api.setAllStatusFilters).toHaveBeenCalledWith(['status-value:error'], []);
  });

  it('does not re-apply filters when already in review mode', async () => {
    const api = makeApi();
    const mode = makeMode();
    await enterReviewMode(api, emptyFilters, mode);
    vi.clearAllMocks();
    await enterReviewMode(api, emptyFilters, mode);
    expect(api.setAllTagFilters).not.toHaveBeenCalled();
    expect(api.setAllStatusFilters).not.toHaveBeenCalled();
  });

  it('rolls back the review-mode flag when the filter setters fail', async () => {
    const api = makeApi();
    const mode = makeMode();
    api.setAllTagFilters.mockRejectedValueOnce(new Error('boom'));
    await expect(enterReviewMode(api, emptyFilters, mode)).rejects.toThrow('boom');
    expect(mode.isActive()).toBe(false);
  });

  it('omits reviewing from the snapshot even when the current filters include it', async () => {
    const mode = makeMode();
    await enterReviewMode(
      makeApi(),
      {
        ...emptyFilters,
        includedStatusFilters: ['status-value:error' as StatusValue, REVIEWING_STATUS_VALUE],
      },
      mode
    );

    const exitApi = makeApi();
    await exitReviewMode(exitApi, mode);
    expect(exitApi.setAllStatusFilters).toHaveBeenCalledWith(['status-value:error'], []);
  });
});

describe('exitReviewMode', () => {
  it('restores snapshotted filters and clears the flag', async () => {
    const mode = makeMode();
    const preReviewFilters: ReviewModeFilters = {
      includedStatusFilters: ['status-value:error' as StatusValue],
      excludedStatusFilters: [],
      includedTagFilters: ['play-fn'],
      excludedTagFilters: [],
    };
    await enterReviewMode(makeApi(), preReviewFilters, mode);

    const api = makeApi();
    await exitReviewMode(api, mode);
    expect(api.setAllTagFilters).toHaveBeenCalledWith(['play-fn'], []);
    expect(api.setAllStatusFilters).toHaveBeenCalledWith(['status-value:error'], []);
    expect(mode.isActive()).toBe(false);
  });

  it('is inert when there is no snapshot to restore', async () => {
    const api = makeApi();
    const mode = makeMode(true);
    await exitReviewMode(api, mode);
    expect(api.setAllTagFilters).not.toHaveBeenCalled();
    expect(api.setAllStatusFilters).not.toHaveBeenCalled();
    expect(api.removeStatusFilters).toHaveBeenCalledWith([REVIEWING_STATUS_VALUE]);
    expect(mode.isActive()).toBe(false);
  });

  it('never restores the reviewing status filter', async () => {
    const mode = makeMode();
    await enterReviewMode(
      makeApi(),
      {
        ...emptyFilters,
        includedStatusFilters: ['status-value:error' as StatusValue],
      },
      mode
    );

    const api = makeApi();
    await exitReviewMode(api, mode);
    expect(api.setAllStatusFilters).toHaveBeenCalledWith(['status-value:error'], []);
    expect(api.setAllStatusFilters).not.toHaveBeenCalledWith(
      expect.arrayContaining([REVIEWING_STATUS_VALUE]),
      expect.anything()
    );
  });
});
