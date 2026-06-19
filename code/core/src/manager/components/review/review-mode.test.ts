// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StatusValue } from 'storybook/internal/types';

import {
  type ReviewModeFilters,
  enterReviewMode,
  exitReviewMode,
  isReviewModeActive,
} from './review-mode.ts';

const emptyFilters: ReviewModeFilters = {
  includedStatusFilters: [],
  excludedStatusFilters: [],
  includedTagFilters: [],
  excludedTagFilters: [],
};

const makeApi = (
  overrides: Partial<{ getIsNavShown: () => boolean; getIsPanelShown: () => boolean }> = {}
) => ({
  toggleNav: vi.fn(),
  togglePanel: vi.fn(),
  getIsNavShown: () => true,
  getIsPanelShown: () => true,
  setAllStatusFilters: vi.fn(async () => {}),
  setAllTagFilters: vi.fn(async () => {}),
  ...overrides,
});

beforeEach(() => {
  sessionStorage.clear();
});

describe('enterReviewMode', () => {
  it('collapses chrome, narrows filters to reviewing, and sets the flag', async () => {
    const api = makeApi();
    await enterReviewMode(api, emptyFilters);

    expect(api.toggleNav).toHaveBeenCalledWith(false);
    expect(api.togglePanel).toHaveBeenCalledWith(false);
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
});

describe('exitReviewMode', () => {
  it('restores only the chrome that was shown before entry and clears the flag', async () => {
    await enterReviewMode(
      makeApi({ getIsNavShown: () => true, getIsPanelShown: () => false }),
      emptyFilters
    );

    const api = makeApi();
    await exitReviewMode(api);
    expect(api.toggleNav).toHaveBeenCalledWith(true);
    expect(api.togglePanel).not.toHaveBeenCalledWith(true);
    expect(isReviewModeActive()).toBe(false);
  });

  it('is inert when there is no snapshot to restore', async () => {
    const api = makeApi();
    await exitReviewMode(api);
    expect(api.toggleNav).not.toHaveBeenCalled();
    expect(isReviewModeActive()).toBe(false);
  });
});
