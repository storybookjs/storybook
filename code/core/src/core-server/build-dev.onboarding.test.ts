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

const ADDONS_WITH_ONBOARDING = ['@storybook/addon-onboarding'];
const ADDONS_WITHOUT_ONBOARDING = ['@storybook/addon-essentials'];

describe('resolveOnboardingInitialPath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns /onboarding and removes cache entry when onboarding-pending is set, no CLI initialPath, and addon is present', async () => {
    mockCacheGet.mockResolvedValue(true);
    const result = await resolveOnboardingInitialPath(undefined, ADDONS_WITH_ONBOARDING);
    expect(result).toBe('/onboarding');
    expect(mockCacheRemove).toHaveBeenCalledWith('onboarding-pending');
  });

  it('returns undefined and does not remove cache when onboarding-pending is absent', async () => {
    mockCacheGet.mockResolvedValue(undefined);
    const result = await resolveOnboardingInitialPath(undefined, ADDONS_WITH_ONBOARDING);
    expect(result).toBeUndefined();
    expect(mockCacheRemove).not.toHaveBeenCalled();
  });

  it('returns CLI initialPath and does NOT remove cache when CLI initialPath is already set', async () => {
    mockCacheGet.mockResolvedValue(true);
    const result = await resolveOnboardingInitialPath('/my-story', ADDONS_WITH_ONBOARDING);
    expect(result).toBe('/my-story');
    expect(mockCacheRemove).not.toHaveBeenCalled();
  });

  it('returns undefined and does NOT remove cache when addon-onboarding is not installed', async () => {
    mockCacheGet.mockResolvedValue(true);
    const result = await resolveOnboardingInitialPath(undefined, ADDONS_WITHOUT_ONBOARDING);
    expect(result).toBeUndefined();
    expect(mockCacheRemove).not.toHaveBeenCalled();
  });

  it('works with object-form addon entries', async () => {
    mockCacheGet.mockResolvedValue(true);
    const result = await resolveOnboardingInitialPath(undefined, [
      { name: '@storybook/addon-onboarding' },
    ]);
    expect(result).toBe('/onboarding');
    expect(mockCacheRemove).toHaveBeenCalledWith('onboarding-pending');
  });
});
