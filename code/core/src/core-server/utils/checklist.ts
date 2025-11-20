import { createFileSystemCache, resolvePathInStorybookCache } from 'storybook/internal/common';
import { experimental_UniversalStore } from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';
import { telemetry } from 'storybook/internal/telemetry';

import { dequal as deepEqual } from 'dequal';

import { globalSettings } from '../../cli';
import {
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
        const checklist = settings.value.checklist;
        const state = {
          items: checklist?.items ?? {},
          widget: checklist?.widget ?? { disable: false },
        };
        const setState = ({
          items = state.items,
          widget = state.widget,
        }: {
          items?: typeof state.items;
          widget?: typeof state.widget;
        }) => {
          settings.value.checklist = { items: items as StoreState['items'], widget };
          settings.save();
        };
        return [state, setState] as const;
      }),

      cache.get<Pick<StoreState, 'items'>>('state').then((cachedState) => {
        const state = { items: cachedState?.items ?? {} };
        const setState = ({ items }: Pick<StoreState, 'items'>) => cache.set('state', { items });
        return [state, setState] as const;
      }),
    ]);

    store.setState(
      (value) =>
        ({
          ...value,
          ...userState,
          ...projectState,
          items: { ...value.items, ...userState.items, ...projectState.items },
          loaded: true,
        }) satisfies StoreState
    );

    store.onStateChange((state: StoreState, previousState: StoreState) => {
      // Split values into project-local (done) and user-local (accepted, skipped) persistence
      const projectValues: Partial<StoreState['items']> = {};
      const userValues: Partial<StoreState['items']> = {};
      Object.entries(state.items).forEach(([id, item]) => {
        if (item.status === 'done') {
          projectValues[id as keyof StoreState['items']] = item;
        } else if (item.status === 'accepted' || item.status === 'skipped') {
          userValues[id as keyof StoreState['items']] = item;
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
