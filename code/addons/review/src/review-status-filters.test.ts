import { describe, expect, it, vi } from 'vitest';
import type { API } from 'storybook/manager-api';
import type { StatusValue } from 'storybook/internal/types';

import { REVIEWING_STATUS_VALUE } from './review-status.ts';
import { setReviewStatusFilters, clearReviewingStatusFilter } from './review-status-filters.ts';

describe('setReviewStatusFilters', () => {
  it('prefers setAllStatusFilters when available', async () => {
    const setAllStatusFilters = vi.fn().mockResolvedValue(undefined);
    const api = { setAllStatusFilters } as unknown as API;

    await setReviewStatusFilters(api, [REVIEWING_STATUS_VALUE], []);

    expect(setAllStatusFilters).toHaveBeenCalledWith([REVIEWING_STATUS_VALUE], []);
  });

  it('falls back to resetStatusFilters and addStatusFilters', async () => {
    const resetStatusFilters = vi.fn().mockResolvedValue(undefined);
    const addStatusFilters = vi.fn().mockResolvedValue(undefined);
    const api = { resetStatusFilters, addStatusFilters } as unknown as API;

    await setReviewStatusFilters(
      api,
      [REVIEWING_STATUS_VALUE],
      ['status-value:new' as StatusValue]
    );

    expect(resetStatusFilters).toHaveBeenCalledOnce();
    expect(addStatusFilters).toHaveBeenNthCalledWith(1, [REVIEWING_STATUS_VALUE], false);
    expect(addStatusFilters).toHaveBeenNthCalledWith(2, ['status-value:new'], true);
  });

  it('no-ops when no status filter APIs are available', async () => {
    await expect(
      setReviewStatusFilters({} as API, [REVIEWING_STATUS_VALUE], [])
    ).resolves.toBeUndefined();
  });
});

describe('clearReviewingStatusFilter', () => {
  it('removes reviewing from included and excluded filters', async () => {
    const setAllStatusFilters = vi.fn().mockResolvedValue(undefined);
    const api = { setAllStatusFilters } as unknown as API;

    await clearReviewingStatusFilter(
      api,
      [REVIEWING_STATUS_VALUE, 'status-value:new' as StatusValue],
      [REVIEWING_STATUS_VALUE]
    );

    expect(setAllStatusFilters).toHaveBeenCalledWith(['status-value:new'], []);
  });

  it('is a no-op when reviewing is not active', async () => {
    const setAllStatusFilters = vi.fn().mockResolvedValue(undefined);
    const api = { setAllStatusFilters } as unknown as API;

    await clearReviewingStatusFilter(api, ['status-value:new' as StatusValue], []);

    expect(setAllStatusFilters).not.toHaveBeenCalled();
  });
});
