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

const testProviderStateChangeListeners: Array<(...args: any[]) => void> = [];
vi.mock('../stores/test-provider.ts', () => ({
  universalTestProviderStore: {
    onStateChange: vi.fn((listener: (...args: any[]) => void) => {
      testProviderStateChangeListeners.push(listener);
      return () => {
        const idx = testProviderStateChangeListeners.indexOf(listener);
        if (idx >= 0) {
          testProviderStateChangeListeners.splice(idx, 1);
        }
      };
    }),
  },
}));

vi.mock('../../telemetry/event-cache.ts', () => ({
  get: vi.fn(),
}));

const AI_IDLE_DELAY_MS = 4 * 60 * 1000;

const aiSetupCacheEntry = {
  timestamp: Date.now(),
  body: { eventType: 'ai-setup' } as TelemetryEvent,
} satisfies CacheEntry;

const aiInitOptInCacheEntry = {
  timestamp: Date.now(),
  body: { eventType: 'ai-init-opt-in' } as TelemetryEvent,
} satisfies CacheEntry;

/** Mock getEventCacheEntry to return specific entries by event type. */
function mockEventCache(events: Record<string, CacheEntry | undefined>) {
  return async (eventType: string) => events[eventType];
}

describe('initializeChecklist', () => {
  let mockStore: MockUniversalStore<StoreState, StoreEvent>;
  let mockSettingsValue: { checklist?: Record<string, unknown> };

  beforeEach(async () => {
    vi.useFakeTimers();
    testProviderStateChangeListeners.length = 0;

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
    vi.mocked(getEventCacheEntry).mockResolvedValue(aiSetupCacheEntry);

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
    vi.mocked(getEventCacheEntry).mockResolvedValue(aiSetupCacheEntry);

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
      const { AI_SETUP_ANALYTICS_REQUEST, GHOST_STORIES_REQUEST } =
        await import('storybook/internal/core-events');
      const { get: getEventCacheEntry } = await import('../../telemetry/event-cache.ts');
      vi.mocked(getEventCacheEntry).mockImplementation(
        mockEventCache({
          'ai-setup': aiSetupCacheEntry,
          'ai-init-opt-in': aiInitOptInCacheEntry,
        })
      );

      const { channel } = createMockChannel();
      const { initializeChecklist } = await import('./checklist.ts');
      await initializeChecklist(channel as any);
      await vi.advanceTimersByTimeAsync(0);

      expect(channel.emit).not.toHaveBeenCalledWith(AI_SETUP_ANALYTICS_REQUEST);
      expect(channel.emit).not.toHaveBeenCalledWith(GHOST_STORIES_REQUEST);
    });

    it('emits ghost stories and analytics after 4 minutes of idle when ai-setup detected at startup', async () => {
      const { AI_SETUP_ANALYTICS_REQUEST, GHOST_STORIES_REQUEST } =
        await import('storybook/internal/core-events');
      const { get: getEventCacheEntry } = await import('../../telemetry/event-cache.ts');
      vi.mocked(getEventCacheEntry).mockImplementation(
        mockEventCache({
          'ai-setup': aiSetupCacheEntry,
          'ai-init-opt-in': aiInitOptInCacheEntry,
        })
      );

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
      vi.mocked(getEventCacheEntry).mockImplementation(
        mockEventCache({
          'ai-setup': aiSetupCacheEntry,
          'ai-init-opt-in': aiInitOptInCacheEntry,
        })
      );

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

    it('resets the idle timer when test provider state changes', async () => {
      const { AI_SETUP_ANALYTICS_REQUEST, GHOST_STORIES_REQUEST } =
        await import('storybook/internal/core-events');
      const { get: getEventCacheEntry } = await import('../../telemetry/event-cache.ts');
      vi.mocked(getEventCacheEntry).mockImplementation(
        mockEventCache({
          'ai-setup': aiSetupCacheEntry,
          'ai-init-opt-in': aiInitOptInCacheEntry,
        })
      );

      const { channel } = createMockChannel();
      const { initializeChecklist } = await import('./checklist.ts');
      await initializeChecklist(channel as any);
      await vi.advanceTimersByTimeAsync(0);

      // Advance 3 minutes (within the 4-minute window)
      await vi.advanceTimersByTimeAsync(3 * 60 * 1000);

      // Simulate test provider state change (e.g. tests started running) — resets the timer
      testProviderStateChangeListeners.forEach((fn) => fn({}, {}, {}));
      await vi.advanceTimersByTimeAsync(0);

      // 3 more minutes after reset — still within the new 4-minute window
      await vi.advanceTimersByTimeAsync(3 * 60 * 1000);
      expect(channel.emit).not.toHaveBeenCalledWith(AI_SETUP_ANALYTICS_REQUEST);
      expect(channel.emit).not.toHaveBeenCalledWith(GHOST_STORIES_REQUEST);

      // 1 more minute — now 4 minutes since last test provider state change
      await vi.advanceTimersByTimeAsync(1 * 60 * 1000);
      expect(channel.emit).toHaveBeenCalledWith(GHOST_STORIES_REQUEST);
      expect(channel.emit).toHaveBeenCalledWith(AI_SETUP_ANALYTICS_REQUEST);
    });

    it('detects ai-setup mid-session when checked at idle time (race condition fix)', async () => {
      const { AI_SETUP_ANALYTICS_REQUEST, GHOST_STORIES_REQUEST, STORY_INDEX_INVALIDATED } =
        await import('storybook/internal/core-events');
      const { get: getEventCacheEntry } = await import('../../telemetry/event-cache.ts');

      // Initially: ai-init-opt-in exists but ai-setup does NOT
      vi.mocked(getEventCacheEntry).mockImplementation(
        mockEventCache({ 'ai-init-opt-in': aiInitOptInCacheEntry })
      );

      const { channel, listeners } = createMockChannel();
      const { initializeChecklist } = await import('./checklist.ts');
      await initializeChecklist(channel as any);
      await vi.advanceTimersByTimeAsync(0);

      expect(mockStore.getState().items.aiSetup.status).toBe('open');

      // Simulate: agent creates files → STORY_INDEX_INVALIDATED fires multiple times
      listeners[STORY_INDEX_INVALIDATED]?.forEach((fn) => fn());
      await vi.advanceTimersByTimeAsync(10_000);
      listeners[STORY_INDEX_INVALIDATED]?.forEach((fn) => fn());
      await vi.advanceTimersByTimeAsync(10_000);
      listeners[STORY_INDEX_INVALIDATED]?.forEach((fn) => fn());

      // ai-setup command finishes AFTER last file change — event now in cache.
      // This is the race condition: no more STORY_INDEX_INVALIDATED events fire,
      // but the idle timer is still running and will check at idle time.
      vi.mocked(getEventCacheEntry).mockImplementation(
        mockEventCache({
          'ai-setup': aiSetupCacheEntry,
          'ai-init-opt-in': aiInitOptInCacheEntry,
        })
      );

      // No more index changes. After 4 minutes of quiet, the idle timer fires.
      await vi.advanceTimersByTimeAsync(AI_IDLE_DELAY_MS);

      // The idle check found ai-setup in the cache → marked done + emitted events
      expect(mockStore.getState().items.aiSetup.status).toBe('done');
      expect(channel.emit).toHaveBeenCalledWith(GHOST_STORIES_REQUEST);
      expect(channel.emit).toHaveBeenCalledWith(AI_SETUP_ANALYTICS_REQUEST);
    });

    it('does not emit if user did not opt into AI', async () => {
      const { AI_SETUP_ANALYTICS_REQUEST, GHOST_STORIES_REQUEST, STORY_INDEX_INVALIDATED } =
        await import('storybook/internal/core-events');
      const { get: getEventCacheEntry } = await import('../../telemetry/event-cache.ts');

      // ai-setup exists but ai-init-opt-in does NOT
      vi.mocked(getEventCacheEntry).mockImplementation(
        mockEventCache({ 'ai-setup': aiSetupCacheEntry })
      );

      const { channel, listeners } = createMockChannel();
      const { initializeChecklist } = await import('./checklist.ts');
      await initializeChecklist(channel as any);
      await vi.advanceTimersByTimeAsync(0);

      // Trigger index change and wait for idle
      listeners[STORY_INDEX_INVALIDATED]?.forEach((fn) => fn());
      await vi.advanceTimersByTimeAsync(AI_IDLE_DELAY_MS);

      expect(channel.emit).not.toHaveBeenCalledWith(AI_SETUP_ANALYTICS_REQUEST);
      expect(channel.emit).not.toHaveBeenCalledWith(GHOST_STORIES_REQUEST);
    });

    it('only emits once even after multiple idle cycles', async () => {
      const { AI_SETUP_ANALYTICS_REQUEST, GHOST_STORIES_REQUEST, STORY_INDEX_INVALIDATED } =
        await import('storybook/internal/core-events');
      const { get: getEventCacheEntry } = await import('../../telemetry/event-cache.ts');
      vi.mocked(getEventCacheEntry).mockImplementation(
        mockEventCache({
          'ai-setup': aiSetupCacheEntry,
          'ai-init-opt-in': aiInitOptInCacheEntry,
        })
      );

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

    it('reschedules when a recent external test-run is detected (e.g. npx vitest by AI agent)', async () => {
      const { AI_SETUP_ANALYTICS_REQUEST, GHOST_STORIES_REQUEST } =
        await import('storybook/internal/core-events');
      const { get: getEventCacheEntry } = await import('../../telemetry/event-cache.ts');

      vi.mocked(getEventCacheEntry).mockImplementation(
        mockEventCache({
          'ai-setup': aiSetupCacheEntry,
          'ai-init-opt-in': aiInitOptInCacheEntry,
        })
      );

      const { channel } = createMockChannel();
      const { initializeChecklist } = await import('./checklist.ts');
      await initializeChecklist(channel as any);
      await vi.advanceTimersByTimeAsync(0);

      // 2 minutes in: agent starts running `npx vitest` — a test-run event is recorded
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
      const testRunEntry = {
        timestamp: Date.now(),
        body: {} as any,
      } satisfies CacheEntry;
      vi.mocked(getEventCacheEntry).mockImplementation(
        mockEventCache({
          'ai-setup': aiSetupCacheEntry,
          'ai-init-opt-in': aiInitOptInCacheEntry,
          'test-run': testRunEntry,
        })
      );

      // 2 more minutes: idle timer fires (4 min total). test-run was only 2 min ago
      // → still within the idle window → reschedule, don't emit yet
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
      expect(channel.emit).not.toHaveBeenCalledWith(AI_SETUP_ANALYTICS_REQUEST);
      expect(channel.emit).not.toHaveBeenCalledWith(GHOST_STORIES_REQUEST);

      // Another 4 minutes (8 min total). test-run was 6 min ago — older than the
      // idle window → agent is done → emit events
      await vi.advanceTimersByTimeAsync(AI_IDLE_DELAY_MS);
      expect(channel.emit).toHaveBeenCalledWith(GHOST_STORIES_REQUEST);
      expect(channel.emit).toHaveBeenCalledWith(AI_SETUP_ANALYTICS_REQUEST);
    });

    it('reschedules when a recent ai-setup-self-healing-scoring event is detected', async () => {
      const { AI_SETUP_ANALYTICS_REQUEST, GHOST_STORIES_REQUEST } =
        await import('storybook/internal/core-events');
      const { get: getEventCacheEntry } = await import('../../telemetry/event-cache.ts');

      vi.mocked(getEventCacheEntry).mockImplementation(
        mockEventCache({
          'ai-setup': aiSetupCacheEntry,
          'ai-init-opt-in': aiInitOptInCacheEntry,
        })
      );

      const { channel } = createMockChannel();
      const { initializeChecklist } = await import('./checklist.ts');
      await initializeChecklist(channel as any);
      await vi.advanceTimersByTimeAsync(0);

      // 2 minutes in: agent finishes a vitest run — self-healing scoring event recorded
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
      const selfHealingEntry = {
        timestamp: Date.now(),
        body: {} as any,
      } satisfies CacheEntry;
      vi.mocked(getEventCacheEntry).mockImplementation(
        mockEventCache({
          'ai-setup': aiSetupCacheEntry,
          'ai-init-opt-in': aiInitOptInCacheEntry,
          'ai-setup-self-healing-scoring': selfHealingEntry,
        })
      );

      // Timer fires (4 min total). self-healing was 2 min ago → reschedule
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
      expect(channel.emit).not.toHaveBeenCalledWith(AI_SETUP_ANALYTICS_REQUEST);
      expect(channel.emit).not.toHaveBeenCalledWith(GHOST_STORIES_REQUEST);

      // Another 4 minutes: self-healing was 6 min ago → emit
      await vi.advanceTimersByTimeAsync(AI_IDLE_DELAY_MS);
      expect(channel.emit).toHaveBeenCalledWith(GHOST_STORIES_REQUEST);
      expect(channel.emit).toHaveBeenCalledWith(AI_SETUP_ANALYTICS_REQUEST);
    });
  });
});
