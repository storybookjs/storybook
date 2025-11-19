import { createFileSystemCache, resolvePathInStorybookCache } from 'storybook/internal/common';
import { experimental_UniversalStore } from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';
import { telemetry } from 'storybook/internal/telemetry';

import { globalSettings } from '../../cli';
import {
  type ItemStatus,
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
          muted: checklist?.muted ?? false,
          values: checklist?.values ?? {},
        };
        const setState = ({
          muted = state.muted,
          values = state.values,
        }: {
          muted?: boolean | string[];
          values?: Record<string, ItemStatus>;
        }) => {
          settings.value.checklist = { muted, values };
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

    store.setState((value) => ({
      ...value,
      muted: userState.muted,
      values: { ...userState.values, ...projectState.values },
      loaded: true,
    }));

    store.onStateChange((state: StoreState, previousState: StoreState) => {
      // Split values into user (accepted, skipped) and project (done) for storage
      const userValues: Record<string, Extract<ItemStatus, 'accepted' | 'skipped'>> = {};
      const projectValues: Record<string, Extract<ItemStatus, 'done'>> = {};

      Object.entries(state.values).forEach(([id, value]) => {
        if (value === 'accepted' || value === 'skipped') {
          userValues[id] = value;
        } else if (value === 'done') {
          projectValues[id] = value;
        }
      });
      saveProjectState({ values: projectValues } as Pick<StoreState, 'values'>);
      saveUserState({ muted: state.muted, values: userValues });

      const changedValues = Object.entries(state.values).filter(
        ([key, value]) => value !== previousState.values[key]
      );
      telemetry('onboarding-checklist', {
        ...(!equals(state.muted, previousState.muted) ? { muted: state.muted } : {}),
        ...(changedValues.length > 0 ? { values: Object.fromEntries(changedValues) } : {}),
      });
    });
  } catch (err) {
    logger.error('Failed to initialize checklist');
    logger.error(err);
  }
}
