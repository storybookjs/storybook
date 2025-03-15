import { createStatusStore } from '../../shared/status-store';
import { UNIVERSAL_STATUS_STORE_OPTIONS } from '../../shared/status-store';
import { UniversalStore } from '../../shared/universal-store';
import { useUniversalStore } from '../../shared/universal-store/use-universal-store-preview';

const statusStore = createStatusStore({
  universalStatusStore: UniversalStore.create({
    ...UNIVERSAL_STATUS_STORE_OPTIONS,
    leader: false,
  }),
  useUniversalStore,
  environment: 'preview',
});

export const { fullStatusStore, getStatusStoreByTypeId, useStatusStore } = statusStore;
