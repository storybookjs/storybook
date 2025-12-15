import { createFileSystemCache, resolvePathInStorybookCache } from 'storybook/internal/common';
import { experimental_UniversalStore } from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';
import { telemetry } from 'storybook/internal/telemetry';

import { dequal as deepEqual } from 'dequal';
import { throttle } from 'es-toolkit/function';
import { toMerged } from 'es-toolkit/object';

import { globalSettings } from '../../cli';
import {
  type ChecklistState,
  type StoreEvent,
  type StoreState,
  UNIVERSAL_CHECKLIST_STORE_OPTIONS,
} from '../../shared/checklist-store';

export async function initializeChecklist() {
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

    store.setState(
      (value) =>
        ({
          ...toMerged(value, toMerged(userState, projectState)),
          loaded: true,
        }) satisfies StoreState
    );

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
