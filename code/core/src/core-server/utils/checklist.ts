import { experimental_UniversalStore } from 'storybook/internal/core-server';

import { globalSettings } from '../../cli';
import {
  type StoreEvent,
  type StoreState,
  UNIVERSAL_CHECKLIST_STORE_OPTIONS,
} from '../../shared/checklist-store';

export function initializeChecklist() {
  const store = experimental_UniversalStore.create<StoreState, StoreEvent>({
    ...UNIVERSAL_CHECKLIST_STORE_OPTIONS,
    leader: true,
  });

  globalSettings().then((settings) => {
    store.setState({
      loaded: true,
      muted: settings.value.checklist?.muted ?? false,
      completed: settings.value.checklist?.completed ?? [],
      skipped: settings.value.checklist?.skipped ?? [],
    });

    store.onStateChange((state) => {
      settings.value.checklist = state;
      settings.save();
    });
  });
}
