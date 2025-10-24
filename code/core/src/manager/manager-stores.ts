import { experimental_UniversalStore } from 'storybook/manager-api';

import {
  type StoreEvent,
  type StoreState,
  UNIVERSAL_CHECKLIST_STORE_OPTIONS,
  createChecklistStore,
} from '../shared/checklist-store';

export {
  internal_fullStatusStore,
  experimental_getStatusStore,
  experimental_useStatusStore,
  internal_fullTestProviderStore,
  experimental_getTestProviderStore,
  experimental_useTestProviderStore,
} from 'storybook/manager-api';

export const universalChecklistStore = experimental_UniversalStore.create<StoreState, StoreEvent>({
  ...UNIVERSAL_CHECKLIST_STORE_OPTIONS,
  leader: globalThis.CONFIG_TYPE === 'PRODUCTION',
  debug: true,
});

export const checklistStore = createChecklistStore(universalChecklistStore);
