import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CacheEntry } from '../../telemetry/event-cache.ts';
import type { TelemetryEvent } from '../../telemetry/types.ts';
import { MockUniversalStore } from '../../shared/universal-store/mock.ts';
import {
  type StoreEvent,
  type StoreState,
  UNIVERSAL_CHECKLIST_STORE_OPTIONS,
} from '../../shared/checklist-store/index.ts';

vi.mock('storybook/internal/common', () => ({
  createFileSystemCache: vi.fn(() => ({
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
  })),
  resolvePathInStorybookCache: vi.fn(() => '/tmp/test-cache'),
}));

vi.mock('storybook/internal/core-server', () => ({
  experimental_UniversalStore: {
    create: vi.fn(),
  },
}));

vi.mock('storybook/internal/node-logger');
vi.mock('storybook/internal/telemetry', () => ({
  telemetry: vi.fn(),
}));

vi.mock('es-toolkit/function', () => ({
  throttle: vi.fn((fn: () => void) => fn),
}));

vi.mock('es-toolkit/object', async () => {
  const actual = await vi.importActual<typeof import('es-toolkit/object')>('es-toolkit/object');
  return actual;
});

vi.mock('../../cli/index.ts', () => ({
  globalSettings: vi.fn(),
}));

vi.mock('../../telemetry/event-cache.ts', () => ({
  get: vi.fn(),
}));

describe('initializeChecklist', () => {
  let mockStore: MockUniversalStore<StoreState, StoreEvent>;
  let mockSettingsValue: { checklist?: Record<string, unknown> };

  beforeEach(async () => {
    mockStore = MockUniversalStore.create<StoreState, StoreEvent>(
      UNIVERSAL_CHECKLIST_STORE_OPTIONS,
      vi
    );

    const { experimental_UniversalStore } = await import('storybook/internal/core-server');
    vi.mocked(experimental_UniversalStore.create).mockReturnValue(
      mockStore as unknown as ReturnType<typeof experimental_UniversalStore.create>
    );

    mockSettingsValue = { checklist: undefined };
    const { globalSettings } = await import('../../cli/index.ts');
    vi.mocked(globalSettings).mockResolvedValue({
      filePath: '/mock/path',
      value: mockSettingsValue,
      save: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof globalSettings>>);
  });

  it('keeps aiSetup as open when no ai-setup event exists in cache', async () => {
    const { get: getEventCacheEntry } = await import('../../telemetry/event-cache.ts');
    vi.mocked(getEventCacheEntry).mockResolvedValue(undefined);

    const { initializeChecklist } = await import('./checklist.ts');
    await initializeChecklist();

    const state = mockStore.getState();
    expect(state.items.aiSetup.status).toBe('open');
  });

  it('marks aiSetup as done when ai-setup event exists in cache', async () => {
    const { get: getEventCacheEntry } = await import('../../telemetry/event-cache.ts');
    vi.mocked(getEventCacheEntry).mockResolvedValue({
      timestamp: Date.now(),
      body: { eventType: 'ai-setup' } as TelemetryEvent,
    } satisfies CacheEntry);

    const { initializeChecklist } = await import('./checklist.ts');
    await initializeChecklist();

    const state = mockStore.getState();
    expect(state.items.aiSetup.status).toBe('done');
  });

  it('does not overwrite aiSetup status if already done from persisted state', async () => {
    // Simulate persisted user state where aiSetup is already 'skipped'
    mockSettingsValue.checklist = {
      items: { aiSetup: { status: 'skipped' } },
      widget: {},
    };

    const { get: getEventCacheEntry } = await import('../../telemetry/event-cache.ts');
    vi.mocked(getEventCacheEntry).mockResolvedValue({
      timestamp: Date.now(),
      body: { eventType: 'ai-setup' } as TelemetryEvent,
    } satisfies CacheEntry);

    const { initializeChecklist } = await import('./checklist.ts');
    await initializeChecklist();

    const state = mockStore.getState();
    // The ai-setup event was found, but status was 'skipped' (not 'open'), so it stays 'skipped'
    expect(state.items.aiSetup.status).toBe('skipped');
  });
});
