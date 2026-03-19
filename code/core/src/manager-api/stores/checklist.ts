import {
  type StoreEvent,
  type StoreState,
  createChecklistStore,
} from '../../shared/checklist-store';
import { UNIVERSAL_CHECKLIST_STORE_OPTIONS } from '../../shared/checklist-store';
import { UniversalStore } from '../../shared/universal-store';

export const universalChecklistStore = UniversalStore.create<StoreState, StoreEvent>({
  ...UNIVERSAL_CHECKLIST_STORE_OPTIONS,
  leader: globalThis.CONFIG_TYPE === 'PRODUCTION',
});

export const checklistStore = createChecklistStore(universalChecklistStore);
