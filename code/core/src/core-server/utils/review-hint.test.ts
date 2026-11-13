import { beforeEach, describe, expect, it, vi } from 'vitest';

import { internal_UniversalStore } from 'storybook/internal/core-server';

import { globalSettings } from '../../cli/index.ts';
import {
  type ReviewHintStoreState,
  UNIVERSAL_REVIEW_HINT_STORE_OPTIONS,
} from '../../shared/review-hint-store/index.ts';
import { MockUniversalStore } from '../../shared/universal-store/mock.ts';
import { initializeReviewHint } from './review-hint.ts';

vi.mock('storybook/internal/core-server', () => ({
  internal_UniversalStore: { create: vi.fn() },
}));
vi.mock('storybook/internal/node-logger');
vi.mock('../../cli/index.ts', () => ({ globalSettings: vi.fn() }));

const setup = async (reviewHint?: { dismissedAt?: number }) => {
  const store = new MockUniversalStore<ReviewHintStoreState>(UNIVERSAL_REVIEW_HINT_STORE_OPTIONS);
  vi.mocked(internal_UniversalStore.create).mockReturnValue(store as any);
  const settings = { value: { reviewHint } as Record<string, any>, save: vi.fn() };
  settings.save.mockResolvedValue(undefined);
  vi.mocked(globalSettings).mockResolvedValue(settings as any);
  await initializeReviewHint();
  return { store, settings };
};

describe('initializeReviewHint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads a dismissal from the user settings', async () => {
    const { store } = await setup({ dismissedAt: 123 });
    expect(store.getState()).toEqual({ dismissedAt: 123, loaded: true });
  });

  it('loads as not dismissed when the user settings have no entry', async () => {
    const { store } = await setup();
    expect(store.getState()).toEqual({ dismissedAt: undefined, loaded: true });
  });

  it('saves a dismissal to the user settings', async () => {
    const { store, settings } = await setup();
    store.setState((state) => ({ ...state, dismissedAt: 456 }));
    expect(settings.value.reviewHint).toEqual({ dismissedAt: 456 });
    expect(settings.save).toHaveBeenCalledOnce();
  });

  it('does not save when the dismissal did not change', async () => {
    const { store, settings } = await setup({ dismissedAt: 123 });
    store.setState((state) => ({ ...state }));
    expect(settings.save).not.toHaveBeenCalled();
  });
});
