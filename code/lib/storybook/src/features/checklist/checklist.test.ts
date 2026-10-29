import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CacheEntry } from '@storybook/core/internal/deep/telemetry/event-cache';
import type { UniversalStore } from '@storybook/core/internal/deep/shared/universal-store';
import { MockUniversalStore } from '@storybook/core/internal/deep/shared/universal-store/mock';
import {
  type StoreEvent,
  type StoreState,
  UNIVERSAL_CHECKLIST_STORE_OPTIONS,
} from '@storybook/core/internal/deep/shared/checklist-store';

vi.mock('@storybook/core/internal/common', () => ({
  createFileSystemCache: vi.fn(() => ({
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
  })),
  resolvePathInStorybookCache: vi.fn(() => '/tmp/test-cache'),
}));

// The two AI-related flags read from the regular fs cache. Mocking the small
// helper module lets each test set the flags directly without having to drive
// the underlying cache through vitest's module resolution.
vi.mock('@storybook/core/internal/deep/utils/ai-checklist-flags', () => ({
  hasAiInitOptIn: vi.fn().mockResolvedValue(false),
  hasAiSetupRun: vi.fn().mockResolvedValue(false),
}));

vi.mock('@storybook/core/internal/node-logger');
vi.mock('@storybook/core/internal/telemetry', () => ({
  telemetry: vi.fn(),
}));

vi.mock('es-toolkit/function', () => ({
  throttle: vi.fn((fn: () => void) => fn),
}));

vi.mock('es-toolkit/object', async () => {
  const actual = await vi.importActual<typeof import('es-toolkit/object')>('es-toolkit/object');
  return actual;
});

vi.mock('@storybook/core/internal/deep/common/globalSettings', () => ({
  globalSettings: vi.fn(),
}));

const testProviderStateChangeListeners: Array<(...args: any[]) => void> = [];
vi.mock('@storybook/core/internal/deep/services/stores/test-provider', () => ({
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

vi.mock('@storybook/core/internal/deep/telemetry/event-cache', () => ({
  get: vi.fn(),
}));

const AI_IDLE_DELAY_MS = 4 * 60 * 1000;

/** Mock getEventCacheEntry to return specific entries by event type. */
function mockEventCache(events: Record<string, CacheEntry | undefined>) {
  return async (eventType: string) => events[eventType];
}

/**
 * Build a fake StoryIndexGenerator-promise getter that yields a story index
 * containing zero or more entries with the `ai-generated` tag.
 */
function fakeStoryIndexGenerator(aiGeneratedStoryCount: number) {
  const entries: Record<string, { type: 'story'; tags: string[] }> = {};
  for (let i = 0; i < aiGeneratedStoryCount; i++) {
    entries[`ai-${i}`] = { type: 'story', tags: ['ai-generated'] };
  }
  return () =>
    Promise.resolve({
      getIndexAndStats: async () => ({ storyIndex: { entries } }),
    } as any);
}

const noStoriesGenerator = fakeStoryIndexGenerator(0);
const oneAiGeneratedStoryGenerator = fakeStoryIndexGenerator(1);

/** Helper to control the AI flag mocks per-test. */
async function setAiFlags({
  optedIn = false,
  setupRan = false,
}: {
  optedIn?: boolean;
  setupRan?: boolean;
}) {
  const flags = await import('@storybook/core/internal/deep/utils/ai-checklist-flags');
  vi.mocked(flags.hasAiInitOptIn).mockResolvedValue(optedIn);
  vi.mocked(flags.hasAiSetupRun).mockResolvedValue(setupRan);
}

describe('initializeChecklist', () => {
  let mockStore: MockUniversalStore<StoreState, StoreEvent>;
  const serverStore = () => mockStore as unknown as UniversalStore<StoreState, StoreEvent>;
  let mockSettingsValue: { checklist?: Record<string, unknown> };

  beforeEach(async () => {
    vi.useFakeTimers();
    testProviderStateChangeListeners.length = 0;
    await setAiFlags({ optedIn: false, setupRan: false });

    mockStore = MockUniversalStore.create<StoreState, StoreEvent>(
      UNIVERSAL_CHECKLIST_STORE_OPTIONS,
      vi
    );

    mockSettingsValue = { checklist: undefined };
    const { globalSettings } = await import('@storybook/core/internal/deep/common/globalSettings');
    vi.mocked(globalSettings).mockResolvedValue({
      filePath: '/mock/path',
      value: mockSettingsValue,
      save: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof globalSettings>>);
  });

  it('sets loaded immediately, even before the AI checks resolve', async () => {
    const { get: getEventCacheEntry } =
      await import('@storybook/core/internal/deep/telemetry/event-cache');
    vi.mocked(getEventCacheEntry).mockReturnValue(new Promise(() => {}));
    const flags = await import('@storybook/core/internal/deep/utils/ai-checklist-flags');
    vi.mocked(flags.hasAiInitOptIn).mockReturnValue(new Promise(() => {}));
    vi.mocked(flags.hasAiSetupRun).mockReturnValue(new Promise(() => {}));

    const { initializeChecklist } = await import('./checklist.ts');
    await initializeChecklist(serverStore());

    const state = mockStore.getState();
    expect(state.loaded).toBe(true);
    expect(state.items.aiSetup.status).toBe('open');
  });

  it('keeps aiSetup as open when ai-setup has never run', async () => {
    const { get: getEventCacheEntry } =
      await import('@storybook/core/internal/deep/telemetry/event-cache');
    vi.mocked(getEventCacheEntry).mockResolvedValue(undefined);

    const { initializeChecklist } = await import('./checklist.ts');
    await initializeChecklist(serverStore(), undefined, oneAiGeneratedStoryGenerator, '/p');
    await vi.advanceTimersByTimeAsync(0);

    const state = mockStore.getState();
    expect(state.items.aiSetup.status).toBe('open');
  });

  it('does NOT mark aiSetup done just because `storybook skills setup` ran (no agent work yet)', async () => {
    const { get: getEventCacheEntry } =
      await import('@storybook/core/internal/deep/telemetry/event-cache');
    vi.mocked(getEventCacheEntry).mockResolvedValue(undefined);
    await setAiFlags({ setupRan: true });

    const { initializeChecklist } = await import('./checklist.ts');
    await initializeChecklist(serverStore(), undefined, noStoriesGenerator, '/p');
    await vi.advanceTimersByTimeAsync(0);

    expect(mockStore.getState().items.aiSetup.status).toBe('open');
  });

  it('marks aiSetup done when ai-setup ran AND ≥1 story carries the ai-generated tag', async () => {
    const { get: getEventCacheEntry } =
      await import('@storybook/core/internal/deep/telemetry/event-cache');
    vi.mocked(getEventCacheEntry).mockResolvedValue(undefined);
    await setAiFlags({ setupRan: true });

    const { initializeChecklist } = await import('./checklist.ts');
    await initializeChecklist(serverStore(), undefined, oneAiGeneratedStoryGenerator, '/p');
    await vi.advanceTimersByTimeAsync(0);

    expect(mockStore.getState().items.aiSetup.status).toBe('done');
  });

  it('still initializes when reading the AI cache fails', async () => {
    const { get: getEventCacheEntry } =
      await import('@storybook/core/internal/deep/telemetry/event-cache');
    vi.mocked(getEventCacheEntry).mockRejectedValue(new Error('cache read failed'));
    const flags = await import('@storybook/core/internal/deep/utils/ai-checklist-flags');
    vi.mocked(flags.hasAiInitOptIn).mockRejectedValueOnce(new Error('cache read failed'));

    const { initializeChecklist } = await import('./checklist.ts');
    await expect(initializeChecklist(serverStore())).resolves.toBeUndefined();
    await vi.advanceTimersByTimeAsync(0);

    const state = mockStore.getState();
    expect(state.loaded).toBe(true);
    expect(state.items.aiSetup.status).toBe('open');
  });

  it('reflects "done" even if the persisted status was "skipped" once agent work appears', async () => {
    mockSettingsValue.checklist = {
      items: { aiSetup: { status: 'skipped' } },
      widget: {},
    };

    const { get: getEventCacheEntry } =
      await import('@storybook/core/internal/deep/telemetry/event-cache');
    vi.mocked(getEventCacheEntry).mockResolvedValue(undefined);
    await setAiFlags({ setupRan: true });

    const { initializeChecklist } = await import('./checklist.ts');
    await initializeChecklist(serverStore(), undefined, oneAiGeneratedStoryGenerator, '/p');
    await vi.advanceTimersByTimeAsync(0);

    expect(mockStore.getState().items.aiSetup.status).toBe('done');
  });

  describe('aiOptIn flag', () => {
    it('flips aiOptIn to match the value found in the regular fs cache (true case)', async () => {
      const { get: getEventCacheEntry } =
        await import('@storybook/core/internal/deep/telemetry/event-cache');
      vi.mocked(getEventCacheEntry).mockResolvedValue(undefined);
      await setAiFlags({ optedIn: true });

      const { initializeChecklist } = await import('./checklist.ts');
      await initializeChecklist(serverStore(), undefined, undefined, '/p');
      await vi.advanceTimersByTimeAsync(0);

      expect(mockStore.getState().aiOptIn).toBe(true);
    });

    it('flips aiOptIn to match the value found in the regular fs cache (false case)', async () => {
      const { get: getEventCacheEntry } =
        await import('@storybook/core/internal/deep/telemetry/event-cache');
      vi.mocked(getEventCacheEntry).mockResolvedValue(undefined);
      await setAiFlags({ optedIn: false });

      const { initializeChecklist } = await import('./checklist.ts');
      await initializeChecklist(serverStore(), undefined, undefined, '/p');
      await vi.advanceTimersByTimeAsync(0);

      expect(mockStore.getState().aiOptIn).toBe(false);
    });
  });

  describe('aiSetupRun flag', () => {
    it('flips aiSetupRun=true when the regular fs cache has it (telemetry-disabled path)', async () => {
      const { get: getEventCacheEntry } =
        await import('@storybook/core/internal/deep/telemetry/event-cache');
      vi.mocked(getEventCacheEntry).mockResolvedValue(undefined);
      await setAiFlags({ setupRan: true });

      const { initializeChecklist } = await import('./checklist.ts');
      await initializeChecklist(serverStore(), undefined, undefined, '/p');
      await vi.advanceTimersByTimeAsync(0);

      expect(mockStore.getState().aiSetupRun).toBe(true);
    });

    it('keeps aiSetupRun=false when cache does not have the flag', async () => {
      const { get: getEventCacheEntry } =
        await import('@storybook/core/internal/deep/telemetry/event-cache');
      vi.mocked(getEventCacheEntry).mockResolvedValue(undefined);

      const { initializeChecklist } = await import('./checklist.ts');
      await initializeChecklist(serverStore());
      await vi.advanceTimersByTimeAsync(0);

      expect(mockStore.getState().aiSetupRun).toBeFalsy();
    });
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

    /** Common setup: opted in via fs cache, ai-setup ran. */
    async function setupCompletedAgentRun() {
      await setAiFlags({ optedIn: true, setupRan: true });
    }

    it('does not emit events immediately when completed agent run is detected at startup', async () => {
      const { AI_SETUP_ANALYTICS_REQUEST, GHOST_STORIES_REQUEST } =
        await import('@storybook/core/internal/core-events');
      const { get: getEventCacheEntry } =
        await import('@storybook/core/internal/deep/telemetry/event-cache');
      vi.mocked(getEventCacheEntry).mockResolvedValue(undefined);

      await setupCompletedAgentRun();
      const { channel } = createMockChannel();
      const { initializeChecklist } = await import('./checklist.ts');
      await initializeChecklist(serverStore(), channel as any, oneAiGeneratedStoryGenerator, '/p');
      await vi.advanceTimersByTimeAsync(0);

      expect(channel.emit).not.toHaveBeenCalledWith(AI_SETUP_ANALYTICS_REQUEST);
      expect(channel.emit).not.toHaveBeenCalledWith(GHOST_STORIES_REQUEST);
    });

    it('emits ghost stories and analytics after 4 min idle when completed agent run is detected at startup', async () => {
      const { AI_SETUP_ANALYTICS_REQUEST, GHOST_STORIES_REQUEST } =
        await import('@storybook/core/internal/core-events');
      const { get: getEventCacheEntry } =
        await import('@storybook/core/internal/deep/telemetry/event-cache');
      vi.mocked(getEventCacheEntry).mockResolvedValue(undefined);

      await setupCompletedAgentRun();
      const { channel } = createMockChannel();
      const { initializeChecklist } = await import('./checklist.ts');
      await initializeChecklist(serverStore(), channel as any, oneAiGeneratedStoryGenerator, '/p');
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(AI_IDLE_DELAY_MS);

      expect(channel.emit).toHaveBeenCalledWith(GHOST_STORIES_REQUEST);
      expect(channel.emit).toHaveBeenCalledWith(AI_SETUP_ANALYTICS_REQUEST);
    });

    it('does NOT emit ghost stories / final scoring when ai-setup ran but no agent work landed', async () => {
      const { AI_SETUP_ANALYTICS_REQUEST, GHOST_STORIES_REQUEST, STORY_INDEX_INVALIDATED } =
        await import('@storybook/core/internal/core-events');
      const { get: getEventCacheEntry } =
        await import('@storybook/core/internal/deep/telemetry/event-cache');
      vi.mocked(getEventCacheEntry).mockResolvedValue(undefined);

      await setupCompletedAgentRun();
      const { channel, listeners } = createMockChannel();
      const { initializeChecklist } = await import('./checklist.ts');
      // Story index has zero ai-generated stories — agent never produced anything.
      await initializeChecklist(serverStore(), channel as any, noStoriesGenerator, '/p');
      await vi.advanceTimersByTimeAsync(0);

      // Trigger the idle pipeline anyway
      listeners[STORY_INDEX_INVALIDATED]?.forEach((fn) => fn());
      await vi.advanceTimersByTimeAsync(AI_IDLE_DELAY_MS);

      expect(channel.emit).not.toHaveBeenCalledWith(AI_SETUP_ANALYTICS_REQUEST);
      expect(channel.emit).not.toHaveBeenCalledWith(GHOST_STORIES_REQUEST);
      expect(mockStore.getState().items.aiSetup.status).toBe('open');
    });

    it('detects agent work mid-session (stories appear after the timer was scheduled)', async () => {
      const { AI_SETUP_ANALYTICS_REQUEST, GHOST_STORIES_REQUEST, STORY_INDEX_INVALIDATED } =
        await import('@storybook/core/internal/core-events');
      const { get: getEventCacheEntry } =
        await import('@storybook/core/internal/deep/telemetry/event-cache');
      vi.mocked(getEventCacheEntry).mockResolvedValue(undefined);

      await setupCompletedAgentRun();
      let aiStories = 0;
      const dynamicGenerator = () =>
        Promise.resolve({
          getIndexAndStats: async () => ({
            storyIndex: {
              entries: Object.fromEntries(
                Array.from({ length: aiStories }, (_, i) => [
                  `ai-${i}`,
                  { type: 'story', tags: ['ai-generated'] },
                ])
              ),
            },
          }),
        } as any);

      const { channel, listeners } = createMockChannel();
      const { initializeChecklist } = await import('./checklist.ts');
      await initializeChecklist(serverStore(), channel as any, dynamicGenerator, '/p');
      await vi.advanceTimersByTimeAsync(0);

      expect(mockStore.getState().items.aiSetup.status).toBe('open');

      aiStories = 3;
      listeners[STORY_INDEX_INVALIDATED]?.forEach((fn) => fn());
      await vi.advanceTimersByTimeAsync(AI_IDLE_DELAY_MS);

      expect(mockStore.getState().items.aiSetup.status).toBe('done');
      expect(channel.emit).toHaveBeenCalledWith(GHOST_STORIES_REQUEST);
      expect(channel.emit).toHaveBeenCalledWith(AI_SETUP_ANALYTICS_REQUEST);
    });

    it('emits even if user did not opt into AI', async () => {
      const { AI_SETUP_ANALYTICS_REQUEST, GHOST_STORIES_REQUEST, STORY_INDEX_INVALIDATED } =
        await import('@storybook/core/internal/core-events');
      const { get: getEventCacheEntry } =
        await import('@storybook/core/internal/deep/telemetry/event-cache');
      vi.mocked(getEventCacheEntry).mockResolvedValue(undefined);

      // ai-setup ran and stories exist, but the user never opted in
      await setAiFlags({ optedIn: false, setupRan: true });

      const { channel, listeners } = createMockChannel();
      const { initializeChecklist } = await import('./checklist.ts');
      await initializeChecklist(serverStore(), channel as any, oneAiGeneratedStoryGenerator, '/p');
      await vi.advanceTimersByTimeAsync(0);

      listeners[STORY_INDEX_INVALIDATED]?.forEach((fn) => fn());
      await vi.advanceTimersByTimeAsync(AI_IDLE_DELAY_MS);

      expect(channel.emit).toHaveBeenCalledWith(AI_SETUP_ANALYTICS_REQUEST);
      expect(channel.emit).toHaveBeenCalledWith(GHOST_STORIES_REQUEST);
    });

    it('only emits once even after multiple idle cycles', async () => {
      const { AI_SETUP_ANALYTICS_REQUEST, GHOST_STORIES_REQUEST, STORY_INDEX_INVALIDATED } =
        await import('@storybook/core/internal/core-events');
      const { get: getEventCacheEntry } =
        await import('@storybook/core/internal/deep/telemetry/event-cache');
      vi.mocked(getEventCacheEntry).mockResolvedValue(undefined);

      await setupCompletedAgentRun();
      const { channel, listeners } = createMockChannel();
      const { initializeChecklist } = await import('./checklist.ts');
      await initializeChecklist(serverStore(), channel as any, oneAiGeneratedStoryGenerator, '/p');
      await vi.advanceTimersByTimeAsync(0);

      await vi.advanceTimersByTimeAsync(AI_IDLE_DELAY_MS);
      expect(channel.emit).toHaveBeenCalledWith(GHOST_STORIES_REQUEST);
      expect(channel.emit).toHaveBeenCalledWith(AI_SETUP_ANALYTICS_REQUEST);

      channel.emit.mockClear();

      listeners[STORY_INDEX_INVALIDATED]?.forEach((fn) => fn());
      await vi.advanceTimersByTimeAsync(AI_IDLE_DELAY_MS);
      expect(channel.emit).not.toHaveBeenCalledWith(AI_SETUP_ANALYTICS_REQUEST);
      expect(channel.emit).not.toHaveBeenCalledWith(GHOST_STORIES_REQUEST);
    });

    it('reschedules when a recent external test-run is detected (e.g. npx vitest by AI agent)', async () => {
      const { AI_SETUP_ANALYTICS_REQUEST, GHOST_STORIES_REQUEST } =
        await import('@storybook/core/internal/core-events');
      const { get: getEventCacheEntry } =
        await import('@storybook/core/internal/deep/telemetry/event-cache');
      vi.mocked(getEventCacheEntry).mockResolvedValue(undefined);

      await setupCompletedAgentRun();
      const { channel } = createMockChannel();
      const { initializeChecklist } = await import('./checklist.ts');
      await initializeChecklist(serverStore(), channel as any, oneAiGeneratedStoryGenerator, '/p');
      await vi.advanceTimersByTimeAsync(0);

      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
      const testRunEntry = {
        timestamp: Date.now(),
        body: {} as any,
      } satisfies CacheEntry;
      vi.mocked(getEventCacheEntry).mockImplementation(
        mockEventCache({ 'test-run': testRunEntry })
      );

      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
      expect(channel.emit).not.toHaveBeenCalledWith(AI_SETUP_ANALYTICS_REQUEST);
      expect(channel.emit).not.toHaveBeenCalledWith(GHOST_STORIES_REQUEST);

      await vi.advanceTimersByTimeAsync(AI_IDLE_DELAY_MS);
      expect(channel.emit).toHaveBeenCalledWith(GHOST_STORIES_REQUEST);
      expect(channel.emit).toHaveBeenCalledWith(AI_SETUP_ANALYTICS_REQUEST);
    });

    it('reschedules when a recent ai-setup-self-healing-scoring event is detected', async () => {
      const { AI_SETUP_ANALYTICS_REQUEST, GHOST_STORIES_REQUEST } =
        await import('@storybook/core/internal/core-events');
      const { get: getEventCacheEntry } =
        await import('@storybook/core/internal/deep/telemetry/event-cache');
      vi.mocked(getEventCacheEntry).mockResolvedValue(undefined);

      await setupCompletedAgentRun();
      const { channel } = createMockChannel();
      const { initializeChecklist } = await import('./checklist.ts');
      await initializeChecklist(serverStore(), channel as any, oneAiGeneratedStoryGenerator, '/p');
      await vi.advanceTimersByTimeAsync(0);

      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
      const selfHealingEntry = {
        timestamp: Date.now(),
        body: {} as any,
      } satisfies CacheEntry;
      vi.mocked(getEventCacheEntry).mockImplementation(
        mockEventCache({ 'ai-setup-self-healing-scoring': selfHealingEntry })
      );

      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
      expect(channel.emit).not.toHaveBeenCalledWith(AI_SETUP_ANALYTICS_REQUEST);
      expect(channel.emit).not.toHaveBeenCalledWith(GHOST_STORIES_REQUEST);

      await vi.advanceTimersByTimeAsync(AI_IDLE_DELAY_MS);
      expect(channel.emit).toHaveBeenCalledWith(GHOST_STORIES_REQUEST);
      expect(channel.emit).toHaveBeenCalledWith(AI_SETUP_ANALYTICS_REQUEST);
    });
  });
});
