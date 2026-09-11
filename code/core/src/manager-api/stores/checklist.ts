import {
  type StoreEvent,
  type StoreState,
  createChecklistStore,
} from '../../shared/checklist-store/index.ts';
import { UNIVERSAL_CHECKLIST_STORE_OPTIONS } from '../../shared/checklist-store/index.ts';
import { UniversalStore } from '../../shared/universal-store/index.ts';

export const universalChecklistStore = UniversalStore.create<StoreState, StoreEvent>({
  ...UNIVERSAL_CHECKLIST_STORE_OPTIONS,
  leader: globalThis.CONFIG_TYPE === 'PRODUCTION',
});

export const checklistStore = createChecklistStore(universalChecklistStore);
