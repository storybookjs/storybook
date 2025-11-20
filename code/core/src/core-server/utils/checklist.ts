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
          values: checklist?.values ?? {},
          widget: checklist?.widget ?? { disable: false },
        };
        const setState = ({
          values = state.values,
          widget = state.widget,
        }: {
          values?: typeof state.values;
          widget?: typeof state.widget;
        }) => {
          settings.value.checklist = { values, widget };
          settings.save();
        };
        return [state, setState] as const;
      }),

      cache.get<Pick<StoreState, 'values'>>('state').then((cachedState) => {
        const state = { values: cachedState?.values ?? {} };
        const setState = ({ values }: Pick<StoreState, 'values'>) => cache.set('state', { values });
        return [state, setState] as const;
      }),
    ]);

    store.setState(
      (value) =>
        ({
          ...value,
          ...userState,
          ...projectState,
          values: { ...value.values, ...userState.values, ...projectState.values },
          loaded: true,
        }) satisfies StoreState
    );

    store.onStateChange((state: StoreState, previousState: StoreState) => {
      // Split values into project-local (done) and user-local (accepted, skipped) persistence
      const projectValues: Record<string, ItemState> = {};
      const userValues: Record<string, ItemState> = {};
      Object.entries(state.values).forEach(([id, value]) => {
        if (value.status === 'done') {
          projectValues[id] = value;
        } else if (value.status === 'accepted' || value.status === 'skipped') {
          userValues[id] = value;
        }
      });
      saveProjectState({ values: projectValues });
      saveUserState({ values: userValues, widget: state.widget });

      const changedValues = Object.entries(state.values).filter(
        ([key, value]) => value !== previousState.values[key]
      );
      telemetry('onboarding-checklist', {
        ...(changedValues.length > 0 ? { values: Object.fromEntries(changedValues) } : {}),
        ...(!equals(state.widget, previousState.widget) ? { widget: state.widget } : {}),
      });
    });
  } catch (err) {
    logger.error('Failed to initialize checklist');
    logger.error(err);
  }
}
