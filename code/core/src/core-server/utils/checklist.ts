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

    // AI-specific: check if the user opted into AI during `storybook init`.
    // Non-blocking — a failure here must never hide the checklist.
    getEventCacheEntry('ai-init-opt-in')
      .then((event) => {
        if (event) {
          store.setState((state) => ({ ...state, aiOptIn: true }));
        }
      })
      .catch(() => {});

    // AI-specific: detect `storybook ai setup` completion and react to it.
    // This runs both at startup and mid-session (on index changes triggered by new story files).
    // Intentionally non-blocking — a failure here must never hide the checklist.
    const markAiSetupDone = async () => {
      try {
        const aiSetupEvent = await getEventCacheEntry('ai-setup');
        if (!aiSetupEvent || store.getState().items.aiSetup?.status === 'done') {
          return false;
        }
        store.setState((state) => ({
          ...state,
          items: {
            ...state.items,
            aiSetup: { ...state.items.aiSetup, status: 'done' },
          },
        }));
        return true;
      } catch {
        return false;
      }
    };

    // Debounced analytics & ghost stories: the agent may be creating many files
    // progressively. We want to score the final state, not intermediate states.
    // Each story index change resets the timer; events only fire after 4 minutes
    // of no story changes — matching the original useDelayedAnalyticsTrigger delay.
    //
    // Important: the `ai-setup` event is written to the cache AFTER `storybook ai setup`
    // finishes creating files, so we must NOT check for it during the flurry of
    // STORY_INDEX_INVALIDATED events. Instead, we wait for idle and check then.
    const AI_IDLE_DELAY_MS = 4 * 60 * 1000;
    let analyticsTimer: ReturnType<typeof setTimeout> | undefined;
    let analyticsEmitted = false;

    const scheduleIdleCheck = () => {
      if (!channel || analyticsEmitted) {
        return;
      }
      clearTimeout(analyticsTimer);
      analyticsTimer = setTimeout(async () => {
        // Only proceed if the user opted into AI
        if (!store.getState().aiOptIn) {
          return;
        }
        // Check the event cache at idle time — ai-setup may have been written
        // after the last STORY_INDEX_INVALIDATED fired.
        await markAiSetupDone();
        if (store.getState().items.aiSetup?.status !== 'done') {
          return;
        }
        analyticsEmitted = true;
        channel.off(STORY_INDEX_INVALIDATED, onIndexInvalidated);
        channel.emit(GHOST_STORIES_REQUEST);
        channel.emit(AI_SETUP_ANALYTICS_REQUEST);
      }, AI_IDLE_DELAY_MS);
    };

    // Check once at startup (non-blocking).
    markAiSetupDone().then((detected) => {
      if (detected) {
        // ai-setup already existed at startup — schedule debounced analytics.
        // The server may have just restarted while the agent is still working.
        scheduleIdleCheck();
      }
    });

    // Listen for mid-session story changes. Every change resets the 4-minute idle
    // timer. When the timer fires, we check the event cache for `ai-setup` and
    // emit analytics if found. This avoids the race condition where `ai-setup` is
    // written to cache after the last file change.
    const onIndexInvalidated = () => {
      if (analyticsEmitted) {
        return;
      }
      scheduleIdleCheck();
    };
    if (channel) {
      channel.on(STORY_INDEX_INVALIDATED, onIndexInvalidated);
    }

    // Also reset the idle timer when test provider state changes. During an agentic
    // session the agent may pause modifying story files for extended periods while
    // running tests. Without this, the 4-minute idle timer based solely on story
    // index changes would fire prematurely while the agent is still active.
    universalTestProviderStore.onStateChange(() => {
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
