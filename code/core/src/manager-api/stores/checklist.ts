import { experimental_UniversalStore } from '..';
import type { StoreEvent, StoreState } from '../../shared/checklist-store';
import {
  UNIVERSAL_CHECKLIST_STORE_OPTIONS,
  createChecklistStore,
} from '../../shared/checklist-store';

export const universalChecklistStore = experimental_UniversalStore.create<StoreState, StoreEvent>({
  ...UNIVERSAL_CHECKLIST_STORE_OPTIONS,
  leader: globalThis.CONFIG_TYPE === 'PRODUCTION',
});

export const checklistStore = createChecklistStore(universalChecklistStore);
