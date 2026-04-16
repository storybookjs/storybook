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

const AI_IDLE_DELAY_MS = 4 * 60 * 1000;

describe('initializeChecklist', () => {
  let mockStore: MockUniversalStore<StoreState, StoreEvent>;
  let mockSettingsValue: { checklist?: Record<string, unknown> };

  beforeEach(async () => {
    vi.useFakeTimers();

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

  it('sets loaded immediately, even before the ai-setup check resolves', async () => {
    const { get: getEventCacheEntry } = await import('../../telemetry/event-cache.ts');
    // Make the AI cache check hang — it should NOT block loaded: true
    vi.mocked(getEventCacheEntry).mockReturnValue(new Promise(() => {}));

    const { initializeChecklist } = await import('./checklist.ts');
    await initializeChecklist();

    const state = mockStore.getState();
    expect(state.loaded).toBe(true);
    expect(state.items.aiSetup.status).toBe('open');
  });

  it('keeps aiSetup as open when no ai-setup event exists in cache', async () => {
    const { get: getEventCacheEntry } = await import('../../telemetry/event-cache.ts');
    vi.mocked(getEventCacheEntry).mockResolvedValue(undefined);

    const { initializeChecklist } = await import('./checklist.ts');
    await initializeChecklist();
    await vi.advanceTimersByTimeAsync(0);

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
    await vi.advanceTimersByTimeAsync(0);

    const state = mockStore.getState();
    expect(state.items.aiSetup.status).toBe('done');
  });

  it('still initializes when reading ai-setup from the event cache fails', async () => {
    const { get: getEventCacheEntry } = await import('../../telemetry/event-cache.ts');
    vi.mocked(getEventCacheEntry).mockRejectedValue(new Error('cache read failed'));

    const { initializeChecklist } = await import('./checklist.ts');
    await expect(initializeChecklist()).resolves.toBeUndefined();
    await vi.advanceTimersByTimeAsync(0);

    const state = mockStore.getState();
    expect(state.loaded).toBe(true);
    expect(state.items.aiSetup.status).toBe('open');
  });

  it('marks aiSetup as done when ai-setup ran even if persisted status was skipped', async () => {
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
    await vi.advanceTimersByTimeAsync(0);

    const state = mockStore.getState();
    expect(state.items.aiSetup.status).toBe('done');
  });

  describe('debounced analytics and ghost stories', () => {
    function createMockChannel() {
      const listeners: Record<string, Function[]> = {};
      return {
        channel: {
          emit: vi.fn(),
          on: vi.fn((event: string, fn: Function) => {
            listeners[event] = listeners[event] || [];
            listeners[event].push(fn);
          }),
          off: vi.fn((event: string, fn: Function) => {
            listeners[event] = listeners[event]?.filter((f) => f !== fn) ?? [];
          }),
        },
        listeners,
      };
    }

    it('does not emit events immediately when ai-setup detected at startup', async () => {
      const { AI_SETUP_ANALYTICS_REQUEST, GHOST_STORIES_REQUEST } = await import(
        'storybook/internal/core-events'
      );
      const { get: getEventCacheEntry } = await import('../../telemetry/event-cache.ts');
      vi.mocked(getEventCacheEntry).mockResolvedValue({
        timestamp: Date.now(),
        body: { eventType: 'ai-setup' } as TelemetryEvent,
      } satisfies CacheEntry);

      const { channel } = createMockChannel();
      const { initializeChecklist } = await import('./checklist.ts');
      await initializeChecklist(channel as any);
      await vi.advanceTimersByTimeAsync(0);

      expect(channel.emit).not.toHaveBeenCalledWith(AI_SETUP_ANALYTICS_REQUEST);
      expect(channel.emit).not.toHaveBeenCalledWith(GHOST_STORIES_REQUEST);
    });

    it('emits ghost stories and analytics after 4 minutes of idle', async () => {
      const { AI_SETUP_ANALYTICS_REQUEST, GHOST_STORIES_REQUEST } = await import(
        'storybook/internal/core-events'
      );
      const { get: getEventCacheEntry } = await import('../../telemetry/event-cache.ts');
      vi.mocked(getEventCacheEntry).mockResolvedValue({
        timestamp: Date.now(),
        body: { eventType: 'ai-setup' } as TelemetryEvent,
      } satisfies CacheEntry);

      const { channel } = createMockChannel();
      const { initializeChecklist } = await import('./checklist.ts');
      await initializeChecklist(channel as any);
      await vi.advanceTimersByTimeAsync(0);

      // Advance past the 4-minute idle delay
      await vi.advanceTimersByTimeAsync(AI_IDLE_DELAY_MS);

      expect(channel.emit).toHaveBeenCalledWith(GHOST_STORIES_REQUEST);
      expect(channel.emit).toHaveBeenCalledWith(AI_SETUP_ANALYTICS_REQUEST);
    });

    it('resets the idle timer on each STORY_INDEX_INVALIDATED', async () => {
      const { AI_SETUP_ANALYTICS_REQUEST, GHOST_STORIES_REQUEST, STORY_INDEX_INVALIDATED } =
        await import('storybook/internal/core-events');
      const { get: getEventCacheEntry } = await import('../../telemetry/event-cache.ts');
      vi.mocked(getEventCacheEntry).mockResolvedValue({
        timestamp: Date.now(),
        body: { eventType: 'ai-setup' } as TelemetryEvent,
      } satisfies CacheEntry);

      const { channel, listeners } = createMockChannel();
      const { initializeChecklist } = await import('./checklist.ts');
      await initializeChecklist(channel as any);
      await vi.advanceTimersByTimeAsync(0);

      // Advance 3 minutes (within the 4-minute window)
      await vi.advanceTimersByTimeAsync(3 * 60 * 1000);

      // Simulate index change — resets the timer
      listeners[STORY_INDEX_INVALIDATED]?.forEach((fn) => fn());
      await vi.advanceTimersByTimeAsync(0);

      // 3 more minutes after reset — still within the new 4-minute window
      await vi.advanceTimersByTimeAsync(3 * 60 * 1000);
      expect(channel.emit).not.toHaveBeenCalledWith(AI_SETUP_ANALYTICS_REQUEST);
      expect(channel.emit).not.toHaveBeenCalledWith(GHOST_STORIES_REQUEST);

      // 1 more minute — now 4 minutes since last index change
      await vi.advanceTimersByTimeAsync(1 * 60 * 1000);
      expect(channel.emit).toHaveBeenCalledWith(GHOST_STORIES_REQUEST);
      expect(channel.emit).toHaveBeenCalledWith(AI_SETUP_ANALYTICS_REQUEST);
    });

    it('detects ai-setup mid-session and debounces before emitting', async () => {
      const { AI_SETUP_ANALYTICS_REQUEST, GHOST_STORIES_REQUEST, STORY_INDEX_INVALIDATED } =
        await import('storybook/internal/core-events');
      const { get: getEventCacheEntry } = await import('../../telemetry/event-cache.ts');
      // Initially no ai-setup event
      vi.mocked(getEventCacheEntry).mockResolvedValue(undefined);

      const { channel, listeners } = createMockChannel();
      const { initializeChecklist } = await import('./checklist.ts');
      await initializeChecklist(channel as any);
      await vi.advanceTimersByTimeAsync(0);

      expect(mockStore.getState().items.aiSetup.status).toBe('open');

      // ai-setup completes: event cache now returns a result
      vi.mocked(getEventCacheEntry).mockResolvedValue({
        timestamp: Date.now(),
        body: { eventType: 'ai-setup' } as TelemetryEvent,
      } satisfies CacheEntry);

      // Trigger STORY_INDEX_INVALIDATED — detects ai-setup
      listeners[STORY_INDEX_INVALIDATED]?.forEach((fn) => fn());
      await vi.advanceTimersByTimeAsync(0);

      // Checklist item should be marked done immediately
      expect(mockStore.getState().items.aiSetup.status).toBe('done');

      // But events should not fire yet
      expect(channel.emit).not.toHaveBeenCalledWith(AI_SETUP_ANALYTICS_REQUEST);
      expect(channel.emit).not.toHaveBeenCalledWith(GHOST_STORIES_REQUEST);

      // After 4 minutes of idle, events fire
      await vi.advanceTimersByTimeAsync(AI_IDLE_DELAY_MS);
      expect(channel.emit).toHaveBeenCalledWith(GHOST_STORIES_REQUEST);
      expect(channel.emit).toHaveBeenCalledWith(AI_SETUP_ANALYTICS_REQUEST);
    });

    it('only emits once even after multiple index changes', async () => {
      const { AI_SETUP_ANALYTICS_REQUEST, GHOST_STORIES_REQUEST, STORY_INDEX_INVALIDATED } =
        await import('storybook/internal/core-events');
      const { get: getEventCacheEntry } = await import('../../telemetry/event-cache.ts');
      vi.mocked(getEventCacheEntry).mockResolvedValue({
        timestamp: Date.now(),
        body: { eventType: 'ai-setup' } as TelemetryEvent,
      } satisfies CacheEntry);

      const { channel, listeners } = createMockChannel();
      const { initializeChecklist } = await import('./checklist.ts');
      await initializeChecklist(channel as any);
      await vi.advanceTimersByTimeAsync(0);

      // Let it fire once
      await vi.advanceTimersByTimeAsync(AI_IDLE_DELAY_MS);
      expect(channel.emit).toHaveBeenCalledWith(GHOST_STORIES_REQUEST);
      expect(channel.emit).toHaveBeenCalledWith(AI_SETUP_ANALYTICS_REQUEST);

      channel.emit.mockClear();

      // More index changes after it already fired — should not fire again
      listeners[STORY_INDEX_INVALIDATED]?.forEach((fn) => fn());
      await vi.advanceTimersByTimeAsync(AI_IDLE_DELAY_MS);
      expect(channel.emit).not.toHaveBeenCalledWith(AI_SETUP_ANALYTICS_REQUEST);
      expect(channel.emit).not.toHaveBeenCalledWith(GHOST_STORIES_REQUEST);
    });
  });
});
