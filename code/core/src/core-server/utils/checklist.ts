import { createFileSystemCache, resolvePathInStorybookCache } from 'storybook/internal/common';
import { experimental_UniversalStore } from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';
import { telemetry } from 'storybook/internal/telemetry';

import { globalSettings } from '../../cli';
import type { ItemState } from '../../shared/checklist-store';
import {
  type StoreEvent,
  type StoreState,
  UNIVERSAL_CHECKLIST_STORE_OPTIONS,
} from '../../shared/checklist-store';

const equals = <T>(a: T, b: T): boolean => {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => equals(value, b[index]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    return (
      aKeys.length === bKeys.length &&
      aKeys.every((key) => equals(a[key as keyof T], b[key as keyof T]))
    );
  }
  return a === b;
};

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
          settings.value.checklist = { items: items, widget };
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
      const projectValues: Record<string, ItemState> = {};
      const userValues: Record<string, ItemState> = {};
      Object.entries(state.items).forEach(([id, item]) => {
        if (item.status === 'done') {
          projectValues[id] = item;
        } else if (item.status === 'accepted' || item.status === 'skipped') {
          userValues[id] = item;
        }
      });
      saveProjectState({ items: projectValues });
      saveUserState({ items: userValues, widget: state.widget });

      const changedValues = Object.entries(state.items).filter(
        ([key, value]) => value !== previousState.items[key]
      );
      telemetry('onboarding-checklist', {
        ...(changedValues.length > 0 ? { items: Object.fromEntries(changedValues) } : {}),
        ...(!equals(state.widget, previousState.widget) ? { widget: state.widget } : {}),
      });
    });
  } catch (err) {
    logger.error('Failed to initialize checklist');
    logger.error(err);
  }
}
