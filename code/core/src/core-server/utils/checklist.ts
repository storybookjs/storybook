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
    const { muted = false, accepted = [], skipped = [] } = settings.value.checklist || {};
    store.setState((value) => ({ ...value, loaded: true, muted, accepted, skipped }));

    store.onStateChange(({ muted, accepted, skipped }) => {
      settings.value.checklist = { muted, accepted, skipped };
      settings.save();
    });
  });
}
