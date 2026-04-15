import { beforeEach, describe, expect, it, vi } from 'vitest';

// Use vi.hoisted so these are available when vi.mock factory runs
const { mockCacheGet, mockCacheRemove } = vi.hoisted(() => ({
  mockCacheGet: vi.fn(),
  mockCacheRemove: vi.fn(),
}));

vi.mock('storybook/internal/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('storybook/internal/common')>();
  return {
    ...actual,
    cache: {
      get: mockCacheGet,
      set: vi.fn(),
      remove: mockCacheRemove,
    },
  };
});

import { resolveOnboardingInitialPath } from './build-dev.ts';

describe('resolveOnboardingInitialPath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns /onboarding and removes cache entry when onboarding-pending is set and no CLI initialPath', async () => {
    mockCacheGet.mockResolvedValue(true);
    const result = await resolveOnboardingInitialPath(undefined);
    expect(result).toBe('/onboarding');
    expect(mockCacheRemove).toHaveBeenCalledWith('onboarding-pending');
  });

  it('returns undefined and does not remove cache when onboarding-pending is absent', async () => {
    mockCacheGet.mockResolvedValue(undefined);
    const result = await resolveOnboardingInitialPath(undefined);
    expect(result).toBeUndefined();
    expect(mockCacheRemove).not.toHaveBeenCalled();
  });

  it('returns CLI initialPath and does NOT remove cache when CLI initialPath is already set', async () => {
    mockCacheGet.mockResolvedValue(true);
    const result = await resolveOnboardingInitialPath('/my-story');
    expect(result).toBe('/my-story');
    expect(mockCacheRemove).not.toHaveBeenCalled();
  });
});
