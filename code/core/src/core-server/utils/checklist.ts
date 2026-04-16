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
    const AI_IDLE_DELAY_MS = 4 * 60 * 1000;
    let analyticsTimer: ReturnType<typeof setTimeout> | undefined;
    let analyticsEmitted = false;
    let cleanupIndexListener: (() => void) | undefined;

    const scheduleAnalytics = () => {
      if (!channel || analyticsEmitted) {
        return;
      }
      clearTimeout(analyticsTimer);
      analyticsTimer = setTimeout(() => {
        analyticsEmitted = true;
        cleanupIndexListener?.();
        channel.emit(GHOST_STORIES_REQUEST);
        channel.emit(AI_SETUP_ANALYTICS_REQUEST);
      }, AI_IDLE_DELAY_MS);
    };

    // Check once at startup (non-blocking).
    markAiSetupDone().then((detected) => {
      if (detected) {
        // ai-setup already existed at startup — schedule debounced analytics.
        // The server may have just restarted while the agent is still working.
        scheduleAnalytics();
      }
    });

    // Also listen for mid-session completion: when `storybook ai setup` creates story files,
    // the file watcher fires STORY_INDEX_INVALIDATED. Re-check the event cache on each
    // invalidation until we detect the event, then stop listening.
    if (channel) {
      let aiSetupDetected = store.getState().items.aiSetup?.status === 'done';

      const onIndexInvalidated = () => {
        if (analyticsEmitted) {
          return;
        }

        if (!aiSetupDetected) {
          // Haven't detected ai-setup yet — check the event cache.
          markAiSetupDone().then((detected) => {
            if (detected) {
              aiSetupDetected = true;
              scheduleAnalytics();
            }
          });
        } else {
          // ai-setup already detected but agent is still creating files —
          // reset the debounce timer so we score the final state.
          scheduleAnalytics();
        }
      };
      channel.on(STORY_INDEX_INVALIDATED, onIndexInvalidated);
      cleanupIndexListener = () => channel.off(STORY_INDEX_INVALIDATED, onIndexInvalidated);

      // Update the detected flag when the store changes (e.g. startup check resolved).
      store.onStateChange((state: StoreState) => {
        if (state.items.aiSetup?.status === 'done') {
          aiSetupDetected = true;
        }
      });
    }

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
