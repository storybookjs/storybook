import { createFileSystemCache, resolvePathInStorybookCache } from 'storybook/internal/common';
import { experimental_UniversalStore } from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';
import { telemetry } from 'storybook/internal/telemetry';

import { dequal as deepEqual } from 'dequal';
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
          settings.save();
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
      // Split values into project-local (done) and user-local (accepted, skipped) persistence
      const projectValues: Partial<StoreState['items']> = {};
      const userValues: Partial<StoreState['items']> = {};
      Object.entries(state.items).forEach(([id, { status, mutedAt }]) => {
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

      const changedValues = Object.entries(state.items).filter(
        ([key, value]) => value !== previousState.items[key as keyof typeof state.items]
      );
      telemetry('onboarding-checklist', {
        ...(changedValues.length > 0 ? { items: Object.fromEntries(changedValues) } : {}),
        ...(!deepEqual(state.widget, previousState.widget) ? { widget: state.widget } : {}),
      });
    });
  } catch (err) {
    logger.error('Failed to initialize checklist');
    logger.error(err);
  }
}
