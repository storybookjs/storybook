import { createFileSystemCache, resolvePathInStorybookCache } from 'storybook/internal/common';
import { experimental_UniversalStore } from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';
import { telemetry } from 'storybook/internal/telemetry';

import { globalSettings } from '../../cli';
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
        const state = {
          muted: settings.value.checklist?.muted ?? false,
          accepted: settings.value.checklist?.accepted ?? [],
          skipped: settings.value.checklist?.skipped ?? [],
        };
        const setState = ({
          muted = false,
          accepted = [],
          skipped = [],
        }: NonNullable<typeof settings.value.checklist>) => {
          settings.value.checklist = { muted, accepted, skipped };
          settings.save();
        };
        return [state, setState] as const;
      }),

      cache.get<Pick<StoreState, 'done'>>('state').then((cachedState) => {
        const state = { done: cachedState?.done ?? [] };
        const setState = ({ done }: Pick<StoreState, 'done'>) => cache.set('state', { done });
        return [state, setState] as const;
      }),
    ]);

    store.setState((value) => ({ ...value, ...userState, ...projectState, loaded: true }));

    store.onStateChange((state: StoreState, previousState: StoreState) => {
      saveProjectState(state);
      saveUserState(state);

      const { muted, accepted, skipped, done } = state;
      const changedProperties = Object.entries({ muted, accepted, skipped, done }).filter(
        ([key, value]) => !equals(value, previousState[key as keyof StoreState])
      );

      telemetry('onboarding-checklist', Object.fromEntries(changedProperties));
    });
  } catch (err) {
    logger.error('Failed to initialize checklist');
    logger.error(err);
  }
}
