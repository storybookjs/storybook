import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearRegistry } from '../../server.ts';
import { reviewServiceDef } from './definition.ts';
import { registerReviewService } from './server.ts';

const review = {
  title: 'Button tweaks',
  description: 'Check primary',
  collections: [
    {
      title: 'Primary',
      rationale: 'edited',
      storyIds: ['button--primary'],
    },
  ],
  changedFiles: ['src/Button.tsx'],
};

describe('registerReviewService', () => {
  beforeEach(() => {
    clearRegistry();
  });

  afterEach(() => {
    clearRegistry();
    vi.restoreAllMocks();
  });

  it('leaves state command handlers to server registration', () => {
    expect(reviewServiceDef.commands.setReview.handler).toBeUndefined();
    expect(reviewServiceDef.commands.markStale.handler).toBeUndefined();
    expect(reviewServiceDef.commands.dismissReview.handler).toBeUndefined();
  });

  it('sets, marks stale, and dismisses the current review', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const service = registerReviewService();

    expect(service.queries.current.get(undefined)).toBeNull();

    await service.commands.setReview({ ...review, stale: true, createdAt: 100 });

    expect(service.queries.current.get(undefined)).toEqual({ ...review, createdAt: 1_000 });

    vi.spyOn(Date, 'now').mockReturnValue(12_000);
    await service.commands.markStale(undefined);
    expect(service.queries.current.get(undefined)).toEqual({
      ...review,
      createdAt: 1_000,
      stale: true,
    });

    await service.commands.dismissReview(undefined);
    expect(service.queries.current.get(undefined)).toBeNull();
  });
});
