import type { Channel } from 'storybook/internal/channels';
import { createFileSystemCache, resolvePathInStorybookCache } from 'storybook/internal/common';
import { experimental_UniversalStore } from 'storybook/internal/core-server';
import {
  AI_SETUP_ANALYTICS_REQUEST,
  GHOST_STORIES_REQUEST,
  STORY_INDEX_INVALIDATED,
} from 'storybook/internal/core-events';
import { logger } from 'storybook/internal/node-logger';
import { telemetry } from 'storybook/internal/telemetry';

import { throttle } from 'es-toolkit/function';
import { toMerged } from 'es-toolkit/object';

import { globalSettings } from '../../cli/index.ts';
import { universalTestProviderStore } from '../stores/test-provider.ts';
import { get as getEventCacheEntry } from '../../telemetry/event-cache.ts';
import {
  type ChecklistState,
  type StoreEvent,
  type StoreState,
  UNIVERSAL_CHECKLIST_STORE_OPTIONS,
} from '../../shared/checklist-store/index.ts';

export async function initializeChecklist(channel?: Channel) {
  try {
    const store = experimental_UniversalStore.create<StoreState, StoreEvent>({
      ...UNIVERSAL_CHECKLIST_STORE_OPTIONS,
      leader: true,
    });

    const cache = createFileSystemCache({
      basePath: resolvePathInStorybookCache('checklist'),
      ns: 'storybook',
    });

    const [[userState, saveUserState], [projectState, saveProjectState]] = await Promise.all([
      globalSettings().then((settings) => {
        const save = throttle(() => settings.save(), 1000);
        const state = {
          items: settings.value.checklist?.items ?? {},
          widget: settings.value.checklist?.widget ?? {},
        };
        const setState = ({
          items = state.items,
          widget = state.widget,
        }: {
          items?: typeof state.items;
          widget?: typeof state.widget;
        }) => {
          settings.value.checklist = { items, widget };
          save();
        };
        return [state, setState] as const;
      }),

      cache.get<Pick<ChecklistState, 'items'>>('state').then((cachedState) => {
        const state = { items: cachedState?.items ?? {} };
        const setState = ({ items }: Pick<ChecklistState, 'items'>) =>
          cache.set('state', { items });
        return [state, setState] as const;
      }),
    ]);

    // Load the checklist immediately so the UI is never blocked.
    store.setState(
      (value) =>
        ({
          ...toMerged(value, toMerged(userState, projectState)),
          loaded: true,
        }) satisfies StoreState
    );

    // AI opt-in flag (set during `storybook init`). Non-blocking so a cache
    // failure cannot hide the checklist.
    getEventCacheEntry('ai-init-opt-in')
      .then((event) => {
        if (event) {
          store.setState((state) => ({ ...state, aiOptIn: true }));
        }
      })
      .catch(() => {});

    // Mark the aiSetup item done if `storybook ai setup` has ever run. Called
    // at startup and on story index changes; errors are swallowed.
    const markAiSetupDone = async () => {
      try {
        const aiSetupEvent = await getEventCacheEntry('ai-setup');
        if (!aiSetupEvent) {
          return false;
        }
        if (store.getState().items.aiSetup?.status !== 'done') {
          store.setState((state) => ({
            ...state,
            items: {
              ...state.items,
              aiSetup: { ...state.items.aiSetup, status: 'done' },
            },
          }));
        }
        return true;
      } catch {
        return false;
      }
    };

    // Debounced analytics + ghost stories: emit exactly once, 4 minutes after
    // activity stops. The timer resets on story-index changes, test-provider
    // state changes, and detected external vitest runs (`npx vitest`). We check
    // for `ai-setup` at idle time rather than eagerly, because the event is
    // cached AFTER `storybook ai setup` finishes its file writes.
    const AI_IDLE_DELAY_MS = 4 * 60 * 1000;
    let analyticsTimer: ReturnType<typeof setTimeout> | undefined;
    let analyticsEmitted = false;

    // Story-index invalidations can arrive in flurries. Throttle the
    // fire-and-forget cache read so we don't hit disk on every tick. The
    // timer-internal markAiSetupDone() below is awaited separately.
    const throttledSyncAiSetupStatus = throttle(() => markAiSetupDone().catch(() => {}), 1000);

    const scheduleIdleCheck = () => {
      if (!channel || analyticsEmitted) {
        return;
      }
      // Sync aiSetup UI immediately so the copy-prompt button disappears as
      // soon as setup completes, instead of after the 4-minute delay.
      throttledSyncAiSetupStatus();
      clearTimeout(analyticsTimer);
      analyticsTimer = setTimeout(async () => {
        if (!store.getState().aiOptIn) {
          return;
        }
        // Agents often run `npx vitest` for many minutes. If a recent
        // `test-run` or `ai-setup-self-healing-scoring` event is in the cache,
        // the agent is still active — reschedule. `CacheEntry.timestamp` is
        // the cache-write time (= event-firing time, writes are synchronous).
        const now = Date.now();
        const [lastTestRun, lastSelfHealing] = await Promise.all([
          getEventCacheEntry('test-run').catch(() => undefined),
          getEventCacheEntry('ai-setup-self-healing-scoring').catch(() => undefined),
        ]);
        const hasRecentTestActivity = [lastTestRun, lastSelfHealing].some(
          (e) => e && now - e.timestamp < AI_IDLE_DELAY_MS
        );
        if (hasRecentTestActivity) {
          scheduleIdleCheck();
          return;
        }
        // Final re-check: ai-setup may have been cached after the last trigger.
        await markAiSetupDone();
        if (store.getState().items.aiSetup?.status !== 'done') {
          return;
        }
        analyticsEmitted = true;
        channel.off(STORY_INDEX_INVALIDATED, onIndexInvalidated);
        unsubscribeTestProvider();
        channel.emit(GHOST_STORIES_REQUEST);
        channel.emit(AI_SETUP_ANALYTICS_REQUEST);
      }, AI_IDLE_DELAY_MS);
    };

    // Startup check: covers the case where the dev server was restarted
    // mid-agentic-session and `ai-setup` was already cached.
    markAiSetupDone().then((detected) => {
      if (detected) {
        scheduleIdleCheck();
      }
    });

    const onIndexInvalidated = () => {
      if (analyticsEmitted) {
        return;
      }
      scheduleIdleCheck();
    };
    if (channel) {
      channel.on(STORY_INDEX_INVALIDATED, onIndexInvalidated);
    }

    // Test-provider state changes also reset the timer — an agent can spend
    // long stretches running tests without touching story files. Captured so
    // we can unsubscribe symmetrically when analytics fires.
    const unsubscribeTestProvider = universalTestProviderStore.onStateChange(() => {
      if (analyticsEmitted) {
        return;
      }
      scheduleIdleCheck();
    });

    store.onStateChange((state: StoreState, previousState: StoreState) => {
      const entries = Object.entries(state.items);

      // Split values into project-local (done) and user-local (accepted, skipped) persistence
      const projectValues: Partial<StoreState['items']> = {};
      const userValues: Partial<StoreState['items']> = {};
      entries.forEach(([id, { status, mutedAt }]) => {
        if (status === 'done') {
          projectValues[id as keyof StoreState['items']] = { status };
        } else if (status === 'accepted' || status === 'skipped') {
          userValues[id as keyof StoreState['items']] = { status };
        }
        if (mutedAt) {
          userValues[id as keyof StoreState['items']] = {
            ...userValues[id as keyof StoreState['items']],
            mutedAt,
          };
        }
      });
      saveProjectState({ items: projectValues as StoreState['items'] });
      saveUserState({ items: userValues, widget: state.widget });

      // Skip telemetry when loading from persistence (first transition to loaded: true)
      if (!previousState.loaded) {
        return;
      }

      // Gather items that have changed state
      const { mutedItems, statusItems } = entries.reduce(
        (acc, [item, { mutedAt, status }]) => {
          const prev = previousState.items[item as keyof typeof state.items];
          if (mutedAt !== prev?.mutedAt) {
            acc.mutedItems.push(item);
          }
          if (status !== prev?.status) {
            acc.statusItems.push(item);
          }
          return acc;
        },
        { mutedItems: [] as string[], statusItems: [] as string[] }
      );
      if (mutedItems.length > 0) {
        telemetry('onboarding-checklist-muted', {
          items: mutedItems,
          completedItems: entries.reduce<string[]>((acc, [id, { status }]) => {
            return status === 'done' || status === 'accepted' ? acc.concat([id]) : acc;
          }, []),
          skippedItems: entries.reduce<string[]>((acc, [id, { status }]) => {
            return status === 'skipped' ? acc.concat([id]) : acc;
          }, []),
        });
      }
      statusItems.forEach((item) => {
        const { status } = state.items[item as keyof typeof state.items];
        telemetry('onboarding-checklist-status', { item, status });
      });
    });
  } catch (err) {
    logger.error('Failed to initialize checklist');
    logger.error(err);
  }
}
